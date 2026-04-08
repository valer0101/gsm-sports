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
import { Repository, DataSource } from 'typeorm';
import { generateDoubleElimination, selectWinner } from '@gsm/bracket-engine';
import type { Player, BracketData } from '@gsm/bracket-engine';
import { Bracket, BracketStatus } from './entities/bracket.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { TournamentsService } from '../tournaments/tournaments.service';
import { EntriesService } from '../entries/entries.service';
import { GenerateBracketDto } from './dto/generate-bracket.dto';
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
    @InjectRepository(TournamentOperator)
    private readonly operatorsRepository: Repository<TournamentOperator>,
    @Inject(forwardRef(() => TournamentsService))
    private readonly tournamentsService: TournamentsService,
    private readonly entriesService: EntriesService,
    private readonly eventsGateway: EventsGateway,
    private readonly dataSource: DataSource,
  ) {}

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

    // Load confirmed entries for this tournament / weight category
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

    // Build Player array — apply custom seeds if provided
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

  async recordResult(
    bracketId: string,
    matchId: string,
    winnerId: string,
    userId: string,
    userRoles: string[] = [],
  ): Promise<Bracket> {
    const bracket = await this.findById(bracketId);

    const isOrganizer = bracket.tournament.organizerId === userId;
    const isAdmin = userRoles.includes('admin');
    const isOperator = await this.operatorsRepository.count({
      where: { tournamentId: bracket.tournamentId, operatorId: userId },
    });

    if (!isOrganizer && !isAdmin && !isOperator) {
      throw new ForbiddenException(
        'Only the organizer, admin, or assigned operator can record match results',
      );
    }

    if (bracket.status === 'completed') {
      throw new BadRequestException('Bracket is already completed');
    }

    if (!bracket.bracketData) {
      throw new BadRequestException('Bracket has no data');
    }

    const updated = selectWinner(bracket.bracketData as unknown as BracketData, matchId, winnerId);

    const newStatus = updated.status === 'completed' ? 'completed' : 'active';

    await this.bracketsRepository.update(bracketId, {
      bracketData: updated as unknown as Record<string, unknown>,
      status: newStatus as BracketStatus,
    } as any);

    if (newStatus === 'completed') {
      this.logger.log(`Bracket ${bracketId} completed. Champion: ${updated.champion}`);
    }

    // Emit real-time update to all clients watching this tournament
    this.eventsGateway.emitBracketUpdate(bracket.tournamentId, bracketId, updated);

    return this.findById(bracketId);
  }

  async reset(bracketId: string, organizerId: string): Promise<Bracket> {
    const bracket = await this.findById(bracketId);

    if (bracket.tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Only the organizer can reset a bracket');
    }

    await this.bracketsRepository.update(bracketId, {
      bracketData: null,
      status: 'pending',
    });

    return this.findById(bracketId);
  }
}
