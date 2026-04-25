import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import {
  generateDoubleElimination,
  generateSingleElimination,
  generateRoundRobin,
  generateSwiss,
  selectWinner,
  resetMatch as resetMatchInBracket,
  validateResult,
  canRecordResult,
  findMatch,
  replacePlayerInSlot as engineReplacePlayer,
  withdrawPlayerFromSlot as engineWithdrawPlayer,
} from '@gsm/bracket-engine';
import type { Player, BracketData } from '@gsm/bracket-engine';
import type { BracketFormat } from '@gsm/shared-types';
import { Bracket, BracketStatus } from './entities/bracket.entity';
import { BracketAuditLog } from './entities/bracket-audit-log.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { TournamentsService } from '../tournaments/tournaments.service';
import { EntriesService } from '../entries/entries.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
import { RecordResultDto } from './dto/record-result.dto';
import { ResetMatchDto } from './dto/reset-match.dto';
import { EventsGateway } from '../events/events.gateway';
import { MatchAssignmentsService } from '../match-assignments/match-assignments.service';
import { resolveSportConfig, isFormatAllowed } from '../sports/sport-config';
import type { SportConfig } from '@gsm/shared-types';
import { TelegramNotificationsService } from '../telegram/telegram-notifications.service';

// Standard arm wrestling weight buckets (kg)
const WEIGHT_BUCKETS = [
  { label: 'до 60 кг', min: null as number | null, max: 60 },
  { label: 'до 70 кг', min: 60, max: 70 },
  { label: 'до 80 кг', min: 70, max: 80 },
  { label: 'до 90 кг', min: 80, max: 90 },
  { label: 'свыше 90 кг', min: 90, max: null as number | null },
];

function getWeightBucket(weightKg: number) {
  for (const bucket of WEIGHT_BUCKETS) {
    const aboveMin = bucket.min === null || weightKg >= bucket.min;
    const belowMax = bucket.max === null || weightKg < bucket.max;
    if (aboveMin && belowMax) return bucket;
  }
  return WEIGHT_BUCKETS[WEIGHT_BUCKETS.length - 1];
}

function ageGroupLabel(ageGroup: string): string {
  switch (ageGroup) {
    case 'juniors':
      return 'Юниоры';
    case 'veterans':
      return 'Ветераны';
    default:
      return 'Взрослые';
  }
}

function mergeSmallCategories(
  groups: Map<
    string,
    { bucket: (typeof WEIGHT_BUCKETS)[0]; ageGroup: string; hand: string; entries: any[] }
  >,
) {
  const sorted = Array.from(groups.entries()).sort(([, a], [, b]) => {
    const ai = WEIGHT_BUCKETS.indexOf(a.bucket);
    const bi = WEIGHT_BUCKETS.indexOf(b.bucket);
    return ai - bi;
  });

  const result = new Map(sorted);
  let changed = true;

  while (changed) {
    changed = false;
    const keys = Array.from(result.keys());
    for (let i = 0; i < keys.length; i++) {
      const group = result.get(keys[i])!;
      if (group.entries.length >= 2) continue;

      const nextKey = keys.find((k, j) => {
        if (j <= i) return false;
        const g = result.get(k)!;
        return g.ageGroup === group.ageGroup && g.hand === group.hand;
      });

      if (nextKey) {
        result.get(nextKey)!.entries.push(...group.entries);
        result.delete(keys[i]);
        changed = true;
        break;
      } else {
        const prevKey = keys
          .slice(0, i)
          .reverse()
          .find((k) => {
            const g = result.get(k)!;
            return g.ageGroup === group.ageGroup && g.hand === group.hand;
          });
        if (prevKey) {
          result.get(prevKey)!.entries.push(...group.entries);
          result.delete(keys[i]);
          changed = true;
          break;
        }
      }
    }
  }

  return result;
}

@Injectable()
export class BracketsService {
  private logger = new Logger(BracketsService.name);

  constructor(
    @InjectRepository(Bracket)
    private readonly bracketsRepository: Repository<Bracket>,
    @InjectRepository(BracketAuditLog)
    private readonly auditRepository: Repository<BracketAuditLog>,
    @InjectRepository(TournamentOperator)
    private readonly operatorsRepository: Repository<TournamentOperator>,
    @Inject(forwardRef(() => TournamentsService))
    private readonly tournamentsService: TournamentsService,
    private readonly entriesService: EntriesService,
    private readonly eventsGateway: EventsGateway,
    private readonly matchAssignmentsService: MatchAssignmentsService,
    private readonly notifications: TelegramNotificationsService,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Authorization helper ──────────────────────────────────

  private async assertCanManageBracket(
    bracket: Bracket,
    userId: string,
    userRoles: string[],
    opts: { allowOperator?: boolean; requireAdmin?: boolean } = {},
  ): Promise<void> {
    const isAdmin = userRoles.includes('admin');
    const isOrganizer = bracket.tournament.organizerId === userId;

    if (opts.requireAdmin && !isAdmin) {
      throw new ForbiddenException('Only admin can perform this action');
    }

    if (isAdmin || isOrganizer) return;

    if (opts.allowOperator) {
      const opCount = await this.operatorsRepository.count({
        where: { tournamentId: bracket.tournamentId, operatorId: userId },
      });
      if (opCount > 0) return;
    }

    throw new ForbiddenException(
      'Only the organizer, admin, or assigned operator can perform this action',
    );
  }

  // ─── Audit helper ─────────────────────────────────────────

  private async writeAudit(
    bracketId: string,
    action: BracketAuditLog['action'],
    changedBy: string | null,
    matchId: string | null,
    oldValue: Record<string, unknown> | null,
    newValue: Record<string, unknown> | null,
    reason?: string,
    em?: EntityManager,
  ): Promise<void> {
    const repo = em ? em.getRepository(BracketAuditLog) : this.auditRepository;
    // No try/catch: if audit write fails inside a transaction, we want the
    // whole state change to roll back — audit integrity is non-negotiable.
    await repo.save(
      repo.create({
        bracketId,
        action,
        changedBy,
        matchId,
        oldValue,
        newValue,
        reason: reason ?? null,
      }),
    );
  }

  // ─── Generate ──────────────────────────────────────────────

  /**
   * Pick the bracket format for a generation request (Phase 3.3a):
   *   1. If the DTO carries `bracketFormat`, validate it against the
   *      sport's `bracketFormats` allow-list (so a chess organizer can't
   *      accidentally request `double_elim`).
   *   2. Otherwise fall back to `sportConfig.defaultBracketFormat`.
   *
   * Phase 3.3a only ships `single_elim` + `double_elim` — round-robin /
   * swiss / groups_playoff are still in the type union but trigger a
   * 400 here until their generators land. This keeps `defaultBracketFormat`
   * meaningful for sports configured to one of the implemented formats
   * while failing loudly for the others.
   */
  private resolveFormat(
    requested: BracketFormat | undefined,
    cfg: SportConfig,
  ): BracketFormat {
    const chosen = requested ?? cfg.defaultBracketFormat;
    if (requested && !isFormatAllowed(cfg, requested)) {
      throw new BadRequestException(
        `Bracket format '${requested}' is not allowed for this sport. ` +
          `Allowed: ${cfg.bracketFormats.join(', ')}.`,
      );
    }
    if (
      chosen !== 'single_elim' &&
      chosen !== 'double_elim' &&
      chosen !== 'round_robin' &&
      chosen !== 'swiss'
    ) {
      throw new BadRequestException(
        `Bracket format '${chosen}' is not yet implemented. ` +
          `Currently supported: single_elim, double_elim, round_robin, swiss.`,
      );
    }
    return chosen;
  }

  /**
   * Build the actual `BracketData` for a list of players using the
   * already-resolved format. Centralised so the three `generate*`
   * methods don't duplicate the dispatch.
   */
  private buildBracket(format: BracketFormat, players: Player[]): BracketData {
    if (format === 'single_elim') return generateSingleElimination(players);
    if (format === 'round_robin') return generateRoundRobin(players);
    if (format === 'swiss') return generateSwiss(players);
    return generateDoubleElimination(players);
  }

  /** Generate bracket for a specific (ageGroup, hand) group */
  async generateForGroup(
    dto: {
      tournamentId: string;
      ageGroup: string;
      hand: string;
      name?: string;
      bracketFormat?: BracketFormat;
    },
    organizerId: string,
  ): Promise<Bracket> {
    const tournament = await this.tournamentsService.findById(dto.tournamentId);

    if (tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Only the organizer can generate brackets');
    }

    const entries = await this.entriesService.findByGroup(dto.tournamentId, dto.ageGroup, dto.hand);

    if (entries.length < 2) {
      throw new BadRequestException(
        `At least 2 entries required for group [${dto.ageGroup}/${dto.hand}], got ${entries.length}`,
      );
    }

    const cfg = resolveSportConfig(
      tournament.sport?.slug ?? '',
      tournament.sport?.config as Parameters<typeof resolveSportConfig>[1],
    );
    const format = this.resolveFormat(dto.bracketFormat, cfg);

    const players: Player[] = entries.map((entry) => ({
      id: entry.id,
      firstName: entry.user?.firstName ?? 'Player',
      lastName: entry.user?.lastName ?? '',
      number: entry.seedNumber ?? 0,
      seed: entry.seedNumber ?? undefined,
      photoUrl: entry.user?.avatarUrl ?? null,
    }));

    const bracketData = this.buildBracket(format, players);

    const bracket = this.bracketsRepository.create({
      tournamentId: dto.tournamentId,
      weightCategoryId: null,
      name: dto.name ?? null,
      status: 'active',
      bracketData: bracketData as unknown as Record<string, unknown>,
    });

    const saved = await this.bracketsRepository.save(bracket);
    this.logger.log(
      `Bracket [${dto.name}] generated for tournament ${dto.tournamentId} (${entries.length} players)`,
    );
    return saved;
  }

  /**
   * Full close-registration flow:
   * groups entries by (ageGroup, hand, weightBucket), merges small categories,
   * creates WeightCategory records, and generates a bracket per category.
   * All DB writes are in a single transaction.
   */
  async generateWithWeightBuckets(
    tournamentId: string,
    bracketFormat?: BracketFormat,
  ): Promise<number> {
    const entryRepo = this.dataSource.getRepository(TournamentEntry);

    const entries: any[] = await entryRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .where('e.tournamentId = :tournamentId', { tournamentId })
      .andWhere('e.status IN (:...statuses)', { statuses: ['confirmed'] })
      .getMany();

    if (entries.length < 2) {
      throw new BadRequestException('At least 2 registered participants are required');
    }

    const tournament = await this.tournamentsService.findById(tournamentId);
    const cfg = resolveSportConfig(
      tournament.sport?.slug ?? '',
      tournament.sport?.config as Parameters<typeof resolveSportConfig>[1],
    );
    const format = this.resolveFormat(bracketFormat, cfg);

    const groups = new Map<
      string,
      { bucket: (typeof WEIGHT_BUCKETS)[0]; ageGroup: string; hand: string; entries: any[] }
    >();

    for (const entry of entries) {
      const bucket = getWeightBucket(Number(entry.weightKg ?? 80));
      const key = `${entry.ageGroup}|${entry.hand}|${bucket.label}`;
      if (!groups.has(key)) {
        groups.set(key, { bucket, ageGroup: entry.ageGroup, hand: entry.hand, entries: [] });
      }
      groups.get(key)!.entries.push(entry);
    }

    const mergedGroups = mergeSmallCategories(groups);

    return this.dataSource.transaction(async (em) => {
      const wcRepo = em.getRepository(WeightCategory);
      const eRepo = em.getRepository(TournamentEntry);
      const bRepo = em.getRepository(Bracket);
      const tRepo = em.getRepository(Tournament);

      await wcRepo.delete({ tournamentId });

      let count = 0;

      for (const [, group] of mergedGroups) {
        if (group.entries.length < 2) continue;

        const catName = `${ageGroupLabel(group.ageGroup)} · ${group.bucket.label} · ${group.hand === 'right' ? 'Правая' : 'Левая'}`;

        const category = await wcRepo.save(
          wcRepo.create({
            tournamentId,
            name: catName,
            minWeight: group.bucket.min,
            maxWeight: group.bucket.max,
            gender: 'male',
          }),
        );

        for (const entry of group.entries) {
          await eRepo.update(entry.id, { weightCategoryId: category.id, status: 'confirmed' });
        }

        const players: Player[] = group.entries.map((entry, idx) => ({
          id: entry.id,
          firstName: entry.user?.firstName ?? 'Player',
          lastName: entry.user?.lastName ?? String(idx + 1),
          number: idx + 1,
          photoUrl: entry.user?.avatarUrl ?? null,
        }));

        await bRepo.save(
          bRepo.create({
            tournamentId,
            weightCategoryId: category.id,
            name: catName,
            status: 'active',
            bracketData: this.buildBracket(format, players) as unknown as Record<string, unknown>,
          }),
        );
        count++;
      }

      if (count === 0) {
        throw new BadRequestException(
          'No categories with enough participants (minimum 2 per category)',
        );
      }

      await tRepo.update(tournamentId, {
        registrationOpen: false,
        bracketGenerated: true,
        status: 'bracket_ready',
      });

      return count;
    });
  }

  async generate(dto: GenerateBracketDto, organizerId: string): Promise<Bracket> {
    const tournament = await this.tournamentsService.findById(dto.tournamentId);

    if (tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Only the organizer can generate brackets');
    }

    const { data: entries } = await this.entriesService.findByTournament(dto.tournamentId, {
      status: 'confirmed',
      weightCategoryId: dto.weightCategoryId,
      limit: 200,
    });

    if (entries.length < 2) {
      throw new BadRequestException(
        'At least 2 confirmed entries are required to generate a bracket',
      );
    }

    const cfg = resolveSportConfig(
      tournament.sport?.slug ?? '',
      tournament.sport?.config as Parameters<typeof resolveSportConfig>[1],
    );
    const format = this.resolveFormat(dto.bracketFormat, cfg);

    const seedMap = new Map((dto.playerSeeds ?? []).map(({ entryId, seed }) => [entryId, seed]));

    const players: Player[] = entries
      .map((entry) => ({
        id: entry.id,
        firstName: entry.user.firstName,
        lastName: entry.user.lastName,
        number: seedMap.get(entry.id) ?? entry.seedNumber ?? 0,
        seed: seedMap.get(entry.id) ?? entry.seedNumber ?? undefined,
        photoUrl: entry.user.avatarUrl ?? null,
      }))
      .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));

    const bracketData = this.buildBracket(format, players);

    const bracket = this.bracketsRepository.create({
      tournamentId: dto.tournamentId,
      weightCategoryId: dto.weightCategoryId ?? null,
      name: dto.name ?? null,
      status: 'active',
      bracketData: bracketData as unknown as Record<string, unknown>,
    });

    const saved = await this.bracketsRepository.save(bracket);
    this.logger.log(
      `Bracket generated for tournament ${dto.tournamentId} (${entries.length} players)`,
    );
    return saved;
  }

  // ─── Read ─────────────────────────────────────────────────

  async findById(id: string): Promise<Bracket> {
    // `tournament.sport` is needed to resolve SportConfig during
    // `startCategory` (requireCheckIn) and other sport-specific branches;
    // include it here so every code path that has a bracket also has the
    // sport without a second query. Missing it silently fell back to
    // SPORT_CONFIG_DEFAULTS and dropped check-in enforcement.
    const bracket = await this.bracketsRepository.findOne({
      where: { id },
      relations: ['tournament', 'tournament.sport', 'weightCategory'],
    });
    if (!bracket) throw new NotFoundException(`Bracket #${id} not found`);
    return bracket;
  }

  async findByTournament(tournamentId: string): Promise<Bracket[]> {
    return this.bracketsRepository.find({
      where: { tournamentId },
      relations: ['weightCategory'],
      order: { createdAt: 'ASC' },
    });
  }

  async getAuditLog(
    bracketId: string,
    userId: string,
    userRoles: string[] = [],
  ): Promise<BracketAuditLog[]> {
    const bracket = await this.findById(bracketId);
    // Only the organizer, admin, or assigned operator can read the log
    await this.assertCanManageBracket(bracket, userId, userRoles, { allowOperator: true });

    return this.auditRepository.find({
      where: { bracketId },
      order: { createdAt: 'DESC' },
      take: 100,
    });
  }

  /** Returns matches where both players are known (not TBD/BYE) and result not yet recorded */
  getPendingMatches(
    bracketData: BracketData,
  ): Array<{ matchId: string; player1: any; player2: any; section: string }> {
    const pending: Array<{ matchId: string; player1: any; player2: any; section: string }> = [];

    const checkMatch = (m: any, section: string) => {
      if (
        m.winner === null &&
        m.player1?.id &&
        m.player2?.id &&
        m.player1.id !== 'tbd' &&
        m.player2.id !== 'tbd' &&
        m.player1.id !== 'bye' &&
        m.player2.id !== 'bye'
      ) {
        pending.push({ matchId: m.id, player1: m.player1, player2: m.player2, section });
      }
    };

    for (const round of bracketData.winnersBracket) {
      for (const m of round) checkMatch(m, 'winners');
    }
    for (const round of bracketData.losersBracket) {
      for (const m of round) checkMatch(m, 'losers');
    }
    checkMatch(bracketData.grandFinal, 'grand_final');
    if (bracketData.superFinal?.needed) {
      checkMatch(bracketData.superFinal, 'super_final');
    }

    return pending;
  }

  // ─── Record result ────────────────────────────────────────

  async recordResult(
    bracketId: string,
    dto: RecordResultDto,
    userId: string,
    userRoles: string[] = [],
  ): Promise<Bracket> {
    const bracket = await this.findById(bracketId);

    await this.assertCanManageBracket(bracket, userId, userRoles, { allowOperator: true });

    if (bracket.isLocked) {
      const isAdmin = userRoles.includes('admin');
      if (!isAdmin) {
        throw new ForbiddenException('Bracket is locked. Only admin can modify results.');
      }
    }

    if (!bracket.bracketData) {
      throw new BadRequestException('Bracket has no data');
    }

    const data = bracket.bracketData as unknown as BracketData;

    // Check if match can be played
    const readyCheck = canRecordResult(data, dto.matchId);
    if (!readyCheck.valid) {
      throw new BadRequestException(readyCheck.errors.join('; '));
    }

    // Validate winner
    const validationCheck = validateResult(data, dto.matchId, dto.winnerId);
    if (!validationCheck.valid) {
      throw new BadRequestException(validationCheck.errors.join('; '));
    }

    // Check if this is a correction of an existing result
    const existingMatch = findMatch(data, dto.matchId);
    const isCorrection = !!existingMatch?.winner;

    if (isCorrection) {
      const isAdmin = userRoles.includes('admin');
      const isOrganizer = bracket.tournament.organizerId === userId;

      if (!isAdmin && !isOrganizer) {
        throw new ForbiddenException(
          'Only admin or organizer can correct an already-recorded result',
        );
      }
      if (!dto.forceCorrect) {
        throw new BadRequestException(
          'Result already recorded. Set forceCorrect=true to override.',
        );
      }
    }

    // Save old state for audit
    const oldMatchSnapshot = existingMatch ? { ...existingMatch } : null;

    // Apply result
    const updated = selectWinner(data, dto.matchId, dto.winnerId, userId);
    const newStatus: BracketStatus = updated.status === 'completed' ? 'completed' : 'active';
    const expectedVersion = bracket.modificationCount ?? 0;

    // Atomic transaction: state change + audit write with optimistic lock
    await this.dataSource.transaction(async (em) => {
      const bRepo = em.getRepository(Bracket);

      // Optimistic lock — only update if modification_count has not changed since we read
      const res = await bRepo
        .createQueryBuilder()
        .update(Bracket)
        .set({
          bracketData: updated as unknown as Record<string, unknown>,
          status: newStatus as BracketStatus,
          lastModifiedBy: userId,
          lastModifiedAt: new Date(),
          modificationCount: expectedVersion + 1,
          completedAt: newStatus === 'completed' ? new Date() : (bracket.completedAt ?? null),
        } as any)
        .where('id = :id AND modification_count = :expected', {
          id: bracketId,
          expected: expectedVersion,
        })
        .execute();

      if (res.affected === 0) {
        throw new BadRequestException(
          'Bracket was modified concurrently. Please refresh and retry.',
        );
      }

      // Audit inside the same transaction — if this throws, state change rolls back
      const action = isCorrection ? 'result_corrected' : 'result_recorded';
      const newMatch = findMatch(updated, dto.matchId);
      await this.writeAudit(
        bracketId,
        action,
        userId,
        dto.matchId,
        oldMatchSnapshot as Record<string, unknown> | null,
        newMatch as unknown as Record<string, unknown> | null,
        dto.notes,
        em,
      );
    });

    if (newStatus === 'completed') {
      this.logger.log(`Bracket ${bracketId} completed. Champion: ${updated.champion}`);
    }

    // Close any active match→table assignment and free the surface. Safe to
    // call unconditionally — it's a no-op when the match wasn't on a table
    // (e.g. result recorded directly by the organizer before the operator
    // flow existed).
    await this.matchAssignmentsService.finishForMatch(bracket.tournamentId, dto.matchId);

    this.eventsGateway.emitBracketUpdate(bracket.tournamentId, bracketId, updated);

    return this.findById(bracketId);
  }

  // ─── Manual edits: replace / withdraw player ──────────────

  /**
   * Replace a player in a slot with a different confirmed entry.
   * Only the organizer or admin can perform this. Not allowed for locked brackets.
   */
  async replacePlayer(
    bracketId: string,
    matchId: string,
    dto: { position: 1 | 2; newEntryId: string; reason: string },
    userId: string,
    userRoles: string[] = [],
  ): Promise<Bracket> {
    const bracket = await this.findById(bracketId);

    await this.assertCanManageBracket(bracket, userId, userRoles, { allowOperator: false });

    if (bracket.isLocked) {
      throw new ForbiddenException('Bracket is locked');
    }

    if (!bracket.bracketData) {
      throw new BadRequestException('Bracket has no data');
    }

    // Fetch replacement entry and verify it belongs to the same tournament
    const newEntry = await this.entriesService.findById(dto.newEntryId);
    if (newEntry.tournamentId !== bracket.tournamentId) {
      throw new BadRequestException(
        'Replacement entry does not belong to this tournament',
      );
    }
    if (newEntry.status !== 'confirmed') {
      throw new BadRequestException('Replacement entry must be in confirmed status');
    }

    const data = bracket.bracketData as unknown as BracketData;
    const match = findMatch(data, matchId);
    if (!match) throw new NotFoundException(`Match ${matchId} not found in bracket`);

    // Player ids in the bracket are entry ids — look up the entry currently
    // in the slot so we can enforce the same (weightCategory, ageGroup, hand).
    // Without this the organizer could silently drop an 80 kg right-hander into
    // a 60 kg left-hand bracket, breaking the division invariants the engine
    // and the rankings depend on.
    const currentSlot = dto.position === 1 ? match.player1 : match.player2;
    if (currentSlot.id && currentSlot.id !== 'tbd' && currentSlot.id !== 'bye') {
      const currentEntry = await this.entriesService.findById(currentSlot.id).catch(() => null);
      if (currentEntry) {
        const mismatches: string[] = [];
        if (
          currentEntry.weightCategoryId &&
          newEntry.weightCategoryId !== currentEntry.weightCategoryId
        ) {
          mismatches.push('weight category');
        }
        if (currentEntry.ageGroup && newEntry.ageGroup !== currentEntry.ageGroup) {
          mismatches.push('age group');
        }
        if (currentEntry.hand && newEntry.hand !== currentEntry.hand) {
          mismatches.push('hand');
        }
        if (mismatches.length > 0) {
          throw new BadRequestException(
            `Replacement entry does not match the slot's ${mismatches.join(', ')}`,
          );
        }
      }
    }

    const oldMatchSnapshot = JSON.parse(JSON.stringify(match));

    const result = engineReplacePlayer(data, matchId, dto.position, {
      id: newEntry.id,
      firstName: newEntry.user?.firstName ?? 'Player',
      lastName: newEntry.user?.lastName ?? '',
      number: newEntry.seedNumber ?? 0,
      seed: newEntry.seedNumber ?? undefined,
    });

    if (!result.ok) {
      throw new BadRequestException(result.error ?? 'Replace failed');
    }

    const expectedVersion = bracket.modificationCount ?? 0;

    await this.dataSource.transaction(async (em) => {
      const bRepo = em.getRepository(Bracket);

      const res = await bRepo
        .createQueryBuilder()
        .update(Bracket)
        .set({
          bracketData: data as unknown as Record<string, unknown>,
          lastModifiedBy: userId,
          lastModifiedAt: new Date(),
          modificationCount: expectedVersion + 1,
        } as any)
        .where('id = :id AND modification_count = :expected', {
          id: bracketId,
          expected: expectedVersion,
        })
        .execute();

      if (res.affected === 0) {
        throw new BadRequestException(
          'Bracket was modified concurrently. Please refresh and retry.',
        );
      }

      const newMatch = findMatch(data, matchId);
      await this.writeAudit(
        bracketId,
        'player_replaced',
        userId,
        matchId,
        oldMatchSnapshot as Record<string, unknown>,
        newMatch as unknown as Record<string, unknown> | null,
        dto.reason,
        em,
      );
    });

    this.eventsGateway.emitBracketUpdate(bracket.tournamentId, bracketId, data);
    return this.findById(bracketId);
  }

  /**
   * Withdraw a player from a pending match — opponent gets an automatic forfeit.
   * Admin, organizer, or assigned operator can perform this.
   */
  async withdrawPlayer(
    bracketId: string,
    matchId: string,
    dto: { position: 1 | 2; reason: string },
    userId: string,
    userRoles: string[] = [],
  ): Promise<Bracket> {
    const bracket = await this.findById(bracketId);

    await this.assertCanManageBracket(bracket, userId, userRoles, { allowOperator: true });

    if (bracket.isLocked) {
      const isAdmin = userRoles.includes('admin');
      if (!isAdmin) {
        throw new ForbiddenException('Bracket is locked. Only admin can modify.');
      }
    }

    if (!bracket.bracketData) {
      throw new BadRequestException('Bracket has no data');
    }

    const data = bracket.bracketData as unknown as BracketData;
    const match = findMatch(data, matchId);
    if (!match) throw new NotFoundException(`Match ${matchId} not found in bracket`);

    const oldMatchSnapshot = JSON.parse(JSON.stringify(match));

    const result = engineWithdrawPlayer(data, matchId, dto.position);
    if (!result.ok || !result.forfeitTo) {
      throw new BadRequestException(result.error ?? 'Withdraw failed');
    }

    // Grant forfeit to the opponent — this propagates the opponent through the bracket.
    const updated = selectWinner(data, matchId, result.forfeitTo, userId);
    const newStatus: BracketStatus = updated.status === 'completed' ? 'completed' : 'active';
    const expectedVersion = bracket.modificationCount ?? 0;

    await this.dataSource.transaction(async (em) => {
      const bRepo = em.getRepository(Bracket);

      const res = await bRepo
        .createQueryBuilder()
        .update(Bracket)
        .set({
          bracketData: updated as unknown as Record<string, unknown>,
          status: newStatus as BracketStatus,
          lastModifiedBy: userId,
          lastModifiedAt: new Date(),
          modificationCount: expectedVersion + 1,
          completedAt: newStatus === 'completed' ? new Date() : (bracket.completedAt ?? null),
        } as any)
        .where('id = :id AND modification_count = :expected', {
          id: bracketId,
          expected: expectedVersion,
        })
        .execute();

      if (res.affected === 0) {
        throw new BadRequestException(
          'Bracket was modified concurrently. Please refresh and retry.',
        );
      }

      const newMatch = findMatch(updated, matchId);
      await this.writeAudit(
        bracketId,
        'player_withdrawn',
        userId,
        matchId,
        oldMatchSnapshot as Record<string, unknown>,
        newMatch as unknown as Record<string, unknown> | null,
        dto.reason,
        em,
      );
    });

    // Withdraw awards the match to the opponent — if the match was on a
    // table, free it.
    await this.matchAssignmentsService.finishForMatch(bracket.tournamentId, matchId);

    // Telegram "your opponent withdrew, you advance" notification to the
    // winner (if they linked). Fails silently on bot outage / unlinked
    // athlete — never blocks the forfeit from returning.
    try {
      const withdrawnPlayer = dto.position === 1 ? match.player1 : match.player2;
      const withdrawnName =
        `${withdrawnPlayer.firstName ?? ''} ${withdrawnPlayer.lastName ?? ''}`.trim() || 'Opponent';
      const winnerEntry = result.forfeitTo
        ? await this.entriesService.findById(result.forfeitTo).catch(() => null)
        : null;
      if (winnerEntry?.userId) {
        await this.notifications.notifyOpponentWithdrew({
          tournamentId: bracket.tournamentId,
          matchId,
          winnerUserId: winnerEntry.userId,
          withdrawnPlayerName: withdrawnName,
          categoryLabel: bracket.weightCategory?.name ?? bracket.name ?? null,
        });
      }
    } catch (err) {
      this.logger.warn(
        `opponent-withdrew notification failed for match ${matchId}: ${(err as Error)?.message ?? 'unknown'}`,
      );
    }

    this.eventsGateway.emitBracketUpdate(bracket.tournamentId, bracketId, updated);
    return this.findById(bracketId);
  }

  // ─── Start category — auto-forfeit no-shows ───────────────

  /**
   * Begin play on this bracket's category. If the sport (or tournament
   * override) has `requireCheckIn = true`, every first-round slot whose
   * entry isn't in `checked_in` is forfeited to its opponent via the
   * existing withdraw-player flow (so propagation + audit come for free).
   *
   * Both-no-show matches are NOT auto-resolved — we return their ids in
   * `doubleNoShow` and let the organizer decide (disqualify both, reseed,
   * or delay). Expect these to be rare in practice.
   *
   * Access: admin or tournament organizer.
   */
  async startCategory(
    bracketId: string,
    userId: string,
    userRoles: string[] = [],
  ): Promise<{
    requireCheckIn: boolean;
    withdrawn: string[];
    skipped: string[];
    doubleNoShow: string[];
    errors: Array<{ matchId: string; error: string }>;
  }> {
    const bracket = await this.findById(bracketId);
    // Operators can't start categories — that's an organizer/admin decision
    // because it commits no-show forfeits across the bracket.
    await this.assertCanManageBracket(bracket, userId, userRoles, { allowOperator: false });

    if (bracket.isLocked) {
      throw new BadRequestException('Bracket is locked');
    }
    if (!bracket.bracketData) {
      throw new BadRequestException('Bracket has no data — generate it first');
    }

    // Resolve the effective timing/check-in config: sport base + tournament override.
    const sport = bracket.tournament.sport;
    const sportConfig: SportConfig = resolveSportConfig(
      sport?.slug ?? '',
      (sport?.config ?? {}) as Partial<SportConfig>,
    );
    const tOverride = (bracket.tournament.sportConfig ?? {}) as Partial<SportConfig>;
    const requireCheckIn = tOverride.requireCheckIn ?? sportConfig.requireCheckIn;

    if (!requireCheckIn) {
      return {
        requireCheckIn: false,
        withdrawn: [],
        skipped: [],
        doubleNoShow: [],
        errors: [],
      };
    }

    // Snapshot first-round matches BEFORE we start mutating the bracket.
    // Deeper rounds have TBD/bye slots that resolve from earlier matches —
    // they don't need their own check-in scan.
    const data = bracket.bracketData as unknown as BracketData;
    const firstRound = data.winnersBracket[0] ?? [];

    type Slot = {
      matchId: string;
      p1Id: string | null;
      p2Id: string | null;
      // A first-round match can already carry a `winner` when the bracket
      // generator pre-resolved a BYE-paired slot — we must not try to
      // withdraw into it, the engine rejects that path.
      preResolved: boolean;
    };
    const slots: Slot[] = firstRound.map((m) => ({
      matchId: m.id,
      p1Id: this.realPlayerId(m.player1?.id),
      p2Id: this.realPlayerId(m.player2?.id),
      preResolved: !!m.winner,
    }));

    const entryIds = Array.from(
      new Set(slots.flatMap((s) => [s.p1Id, s.p2Id]).filter((id): id is string => !!id)),
    );
    const entries = await this.entriesService.findByIds(entryIds);
    const entryById = new Map(entries.map((e) => [e.id, e]));

    const isNoShow = (entryId: string | null): boolean => {
      if (!entryId) return false;
      const e = entryById.get(entryId);
      if (!e) return false;
      // Entries already in a "handled" terminal state — withdrawn (explicit
      // drop) or rejected (organizer denied the registration) — are not
      // forfeited again. Only `pending`/`confirmed`/anything else counts as
      // a no-show.
      return e.status !== 'checked_in' && e.status !== 'withdrawn' && e.status !== 'rejected';
    };

    const withdrawn: string[] = [];
    const skipped: string[] = [];
    const doubleNoShow: string[] = [];
    const errors: Array<{ matchId: string; error: string }> = [];

    for (const slot of slots) {
      // Byes / already-forfeited slots arrive here with a winner already set.
      // We still record what we found so the UI can show "nothing to do".
      if (slot.preResolved) {
        if (slot.p1Id) skipped.push(slot.p1Id);
        if (slot.p2Id) skipped.push(slot.p2Id);
        continue;
      }

      const p1NoShow = isNoShow(slot.p1Id);
      const p2NoShow = isNoShow(slot.p2Id);

      if (p1NoShow && p2NoShow) {
        doubleNoShow.push(slot.matchId);
        continue;
      }

      // Each forfeit runs its own transaction (inside withdrawPlayer). Catch
      // per-match failures (concurrent edit, engine rejection, etc.) and
      // keep going — partially applied forfeits are still better than
      // aborting the whole category start mid-loop.
      try {
        if (p1NoShow && slot.p1Id) {
          await this.withdrawPlayer(
            bracketId,
            slot.matchId,
            { position: 1, reason: 'no-show (auto-forfeit at category start)' },
            userId,
            userRoles,
          );
          withdrawn.push(slot.p1Id);
        } else if (p2NoShow && slot.p2Id) {
          await this.withdrawPlayer(
            bracketId,
            slot.matchId,
            { position: 2, reason: 'no-show (auto-forfeit at category start)' },
            userId,
            userRoles,
          );
          withdrawn.push(slot.p2Id);
        } else {
          if (slot.p1Id) skipped.push(slot.p1Id);
          if (slot.p2Id) skipped.push(slot.p2Id);
        }
      } catch (err) {
        const message = (err as Error)?.message ?? 'unknown error';
        this.logger.warn(`start-category: match ${slot.matchId} forfeit failed: ${message}`);
        errors.push({ matchId: slot.matchId, error: message });
      }
    }

    this.logger.log(
      `Bracket ${bracketId} start-category: withdrew ${withdrawn.length} no-shows, ` +
        `${doubleNoShow.length} double-no-show matches skipped for manual review, ` +
        `${errors.length} errors`,
    );

    return { requireCheckIn: true, withdrawn, skipped, doubleNoShow, errors };
  }

  /** Convert bracket player id → real entry id (null for `tbd` / `bye`). */
  private realPlayerId(id: string | undefined): string | null {
    if (!id || id === 'tbd' || id === 'bye') return null;
    return id;
  }

  // ─── Reset single match ───────────────────────────────────

  async resetSingleMatch(
    bracketId: string,
    dto: ResetMatchDto,
    userId: string,
    userRoles: string[] = [],
  ): Promise<Bracket> {
    const bracket = await this.findById(bracketId);

    // Only admin or organizer can reset individual matches
    await this.assertCanManageBracket(bracket, userId, userRoles, { allowOperator: false });

    if (!bracket.bracketData) {
      throw new BadRequestException('Bracket has no data');
    }

    const data = bracket.bracketData as unknown as BracketData;
    const match = findMatch(data, dto.matchId);
    if (!match) {
      throw new NotFoundException(`Match ${dto.matchId} not found in bracket`);
    }

    const oldMatchSnapshot = { ...match };

    const updated = resetMatchInBracket(data, dto.matchId);
    const newStatus: BracketStatus = updated.status === 'completed' ? 'completed' : 'active';
    const expectedVersion = bracket.modificationCount ?? 0;

    await this.dataSource.transaction(async (em) => {
      const bRepo = em.getRepository(Bracket);

      const res = await bRepo
        .createQueryBuilder()
        .update(Bracket)
        .set({
          bracketData: updated as unknown as Record<string, unknown>,
          status: newStatus as BracketStatus,
          lastModifiedBy: userId,
          lastModifiedAt: new Date(),
          modificationCount: expectedVersion + 1,
          completedAt: newStatus === 'completed' ? (bracket.completedAt ?? null) : null,
        } as any)
        .where('id = :id AND modification_count = :expected', {
          id: bracketId,
          expected: expectedVersion,
        })
        .execute();

      if (res.affected === 0) {
        throw new BadRequestException(
          'Bracket was modified concurrently. Please refresh and retry.',
        );
      }

      await this.writeAudit(
        bracketId,
        'match_reset',
        userId,
        dto.matchId,
        oldMatchSnapshot as Record<string, unknown>,
        null,
        dto.reason,
        em,
      );
    });

    this.eventsGateway.emitBracketUpdate(bracket.tournamentId, bracketId, updated);

    return this.findById(bracketId);
  }

  // ─── Reset entire bracket ─────────────────────────────────

  async reset(bracketId: string, organizerId: string, userRoles: string[] = []): Promise<Bracket> {
    const bracket = await this.findById(bracketId);

    await this.assertCanManageBracket(bracket, organizerId, userRoles, { allowOperator: false });

    const expectedVersion = bracket.modificationCount ?? 0;

    await this.dataSource.transaction(async (em) => {
      const bRepo = em.getRepository(Bracket);

      await this.writeAudit(
        bracketId,
        'bracket_reset',
        organizerId,
        null,
        bracket.bracketData as Record<string, unknown> | null,
        null,
        'Full bracket reset',
        em,
      );

      const res = await bRepo
        .createQueryBuilder()
        .update(Bracket)
        .set({
          bracketData: null,
          status: 'pending',
          lastModifiedBy: organizerId,
          lastModifiedAt: new Date(),
          modificationCount: expectedVersion + 1,
          completedAt: null,
          isLocked: false,
        } as any)
        .where('id = :id AND modification_count = :expected', {
          id: bracketId,
          expected: expectedVersion,
        })
        .execute();

      if (res.affected === 0) {
        throw new BadRequestException(
          'Bracket was modified concurrently. Please refresh and retry.',
        );
      }
    });

    return this.findById(bracketId);
  }

  // ─── Lock / unlock ────────────────────────────────────────

  async setLocked(
    bracketId: string,
    locked: boolean,
    userId: string,
    userRoles: string[],
  ): Promise<Bracket> {
    const bracket = await this.findById(bracketId);

    await this.assertCanManageBracket(bracket, userId, userRoles, { allowOperator: false });

    await this.dataSource.transaction(async (em) => {
      const bRepo = em.getRepository(Bracket);

      await bRepo.update(bracketId, {
        isLocked: locked,
        lastModifiedBy: userId,
        lastModifiedAt: new Date(),
      });

      await this.writeAudit(
        bracketId,
        locked ? 'bracket_locked' : 'bracket_unlocked',
        userId,
        null,
        null,
        null,
        undefined,
        em,
      );
    });

    this.logger.log(`Bracket ${bracketId} ${locked ? 'locked' : 'unlocked'} by ${userId}`);

    return this.findById(bracketId);
  }
}
