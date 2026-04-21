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
  selectWinner,
  resetMatch as resetMatchInBracket,
  validateResult,
  canRecordResult,
  findMatch,
} from '@gsm/bracket-engine';
import type { Player, BracketData } from '@gsm/bracket-engine';
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

  /** Generate bracket for a specific (ageGroup, hand) group */
  async generateForGroup(
    dto: { tournamentId: string; ageGroup: string; hand: string; name?: string },
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

    const players: Player[] = entries.map((entry) => ({
      id: entry.id,
      firstName: entry.user?.firstName ?? 'Player',
      lastName: entry.user?.lastName ?? '',
      number: entry.seedNumber ?? 0,
      seed: entry.seedNumber ?? undefined,
    }));

    const bracketData = generateDoubleElimination(players);

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
  async generateWithWeightBuckets(tournamentId: string): Promise<number> {
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
        }));

        await bRepo.save(
          bRepo.create({
            tournamentId,
            weightCategoryId: category.id,
            name: catName,
            status: 'active',
            bracketData: generateDoubleElimination(players) as unknown as Record<string, unknown>,
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

    const seedMap = new Map((dto.playerSeeds ?? []).map(({ entryId, seed }) => [entryId, seed]));

    const players: Player[] = entries
      .map((entry) => ({
        id: entry.id,
        firstName: entry.user.firstName,
        lastName: entry.user.lastName,
        number: seedMap.get(entry.id) ?? entry.seedNumber ?? 0,
        seed: seedMap.get(entry.id) ?? entry.seedNumber ?? undefined,
      }))
      .sort((a, b) => (a.seed ?? 999) - (b.seed ?? 999));

    const bracketData = generateDoubleElimination(players);

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
    const bracket = await this.bracketsRepository.findOne({
      where: { id },
      relations: ['tournament', 'weightCategory'],
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

    this.eventsGateway.emitBracketUpdate(bracket.tournamentId, bracketId, updated);

    return this.findById(bracketId);
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
