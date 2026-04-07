import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { generateDoubleElimination } from '@gsm/bracket-engine';
import type { Player } from '@gsm/bracket-engine';
import { Tournament } from './entities/tournament.entity';
import { WeightCategory } from './entities/weight-category.entity';
import { TournamentOperator } from './entities/tournament-operator.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

interface FindAllOptions {
  sport?: string;
  status?: string;
  country?: string;
  page?: number;
  limit?: number;
}

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

@Injectable()
export class TournamentsService {
  private logger = new Logger(TournamentsService.name);

  constructor(
    @InjectRepository(Tournament)
    private readonly tournamentsRepository: Repository<Tournament>,
    @InjectRepository(WeightCategory)
    private readonly weightCategoriesRepository: Repository<WeightCategory>,
    @InjectRepository(TournamentOperator)
    private readonly operatorsRepository: Repository<TournamentOperator>,
    private readonly dataSource: DataSource,
  ) {}

  // ─── Tournaments CRUD ────────────────────────────────────────────────────────

  async findAll(options: FindAllOptions = {}) {
    const { sport, status, country, page = 1, limit = 20 } = options;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const qb = this.tournamentsRepository
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.sport', 'sport')
      .leftJoinAndSelect('t.weightCategories', 'wc')
      .orderBy('t.startDate', 'DESC')
      .take(take)
      .skip(skip);

    if (sport) qb.andWhere('sport.slug = :sport', { sport });
    if (status) qb.andWhere('t.status = :status', { status });
    if (country) qb.andWhere('t.country = :country', { country });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async findBySlug(slug: string): Promise<Tournament> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { slug },
      relations: ['sport', 'organizer', 'weightCategories'],
    });
    if (!tournament) throw new NotFoundException(`Tournament '${slug}' not found`);
    return tournament;
  }

  async findById(id: string): Promise<Tournament> {
    const tournament = await this.tournamentsRepository.findOne({
      where: { id },
      relations: ['sport', 'organizer', 'weightCategories'],
    });
    if (!tournament) throw new NotFoundException(`Tournament #${id} not found`);
    return tournament;
  }

  async create(dto: CreateTournamentDto, organizerId: string): Promise<Tournament> {
    const slug = this.generateSlug(dto.name, dto.startDate);
    const tournament = this.tournamentsRepository.create({
      ...dto,
      slug,
      organizerId,
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      registrationDeadline: dto.registrationDeadline ? new Date(dto.registrationDeadline) : null,
      status: 'draft',
    });
    const saved = await this.tournamentsRepository.save(tournament);

    if (dto.weightCategories?.length) {
      const categories = dto.weightCategories.map((wc, idx) =>
        this.weightCategoriesRepository.create({
          ...wc,
          tournamentId: saved.id,
          sortOrder: wc.sortOrder ?? idx,
        }),
      );
      await this.weightCategoriesRepository.save(categories);
    }

    this.logger.log(`Tournament created: ${saved.name} by ${organizerId}`);
    return this.findById(saved.id);
  }

  async update(id: string, dto: UpdateTournamentDto, userId: string): Promise<Tournament> {
    const tournament = await this.findById(id);
    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can update this tournament');
    }
    const updateData: Partial<Tournament> = { ...dto } as Partial<Tournament>;
    if (dto.startDate) updateData.startDate = new Date(dto.startDate);
    if (dto.endDate) updateData.endDate = new Date(dto.endDate);
    await this.tournamentsRepository.update(id, updateData as any);
    return this.findById(id);
  }

  async updateStatus(id: string, status: string, userId: string): Promise<Tournament> {
    const tournament = await this.findById(id);
    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can update tournament status');
    }
    await this.tournamentsRepository.update(id, { status });
    return this.findById(id);
  }

  async toggleRegistration(id: string, userId: string): Promise<Tournament> {
    const tournament = await this.findById(id);
    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can manage registration');
    }
    if (tournament.bracketGenerated) {
      throw new BadRequestException('Cannot reopen registration after bracket has been generated');
    }
    const newOpen = !tournament.registrationOpen;
    await this.tournamentsRepository.update(id, {
      registrationOpen: newOpen,
      status: newOpen ? 'registration_open' : 'registration_closed',
    });
    return this.findById(id);
  }

  // ─── Registrations ──────────────────────────────────────────────────────────

  async getRegistrations(
    tournamentId: string,
    options: { ageGroup?: string; hand?: string; page?: number; limit?: number } = {},
  ) {
    const { ageGroup, hand, page = 1, limit = 50 } = options;
    const take = Math.min(limit, 200);
    const skip = (page - 1) * take;

    const qb = this.dataSource
      .getRepository(TournamentEntry)
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .leftJoinAndSelect('e.weightCategory', 'wc')
      .where('e.tournamentId = :tournamentId', { tournamentId })
      .orderBy('e.createdAt', 'ASC')
      .take(take)
      .skip(skip);

    if (ageGroup) qb.andWhere('e.ageGroup = :ageGroup', { ageGroup });
    if (hand) qb.andWhere('e.hand = :hand', { hand });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async registerParticipant(
    tournamentId: string,
    userId: string,
    dto: { ageGroup: string; hand: string; weightKg: number; notes?: string },
  ) {
    const tournament = await this.findById(tournamentId);

    if (!tournament.registrationOpen) {
      throw new BadRequestException('Registration is closed for this tournament');
    }
    if (tournament.bracketGenerated) {
      throw new BadRequestException('Cannot register after bracket has been generated');
    }
    if (tournament.registrationDeadline && new Date() > tournament.registrationDeadline) {
      throw new BadRequestException('Registration deadline has passed');
    }

    const entryRepo = this.dataSource.getRepository(TournamentEntry);

    return this.dataSource.transaction(async (em) => {
      const repo = em.getRepository(TournamentEntry);

      const existing = await repo.findOne({
        where: { tournamentId, userId, ageGroup: dto.ageGroup as any, hand: dto.hand },
      });
      if (existing) {
        throw new ConflictException(
          `You are already registered in the ${dto.ageGroup} / ${dto.hand} hand category`,
        );
      }

      if (tournament.maxParticipants) {
        const count = await repo.count({ where: { tournamentId, status: 'confirmed' } });
        if (count >= tournament.maxParticipants) {
          throw new BadRequestException('Tournament is full');
        }
      }

      const entry = repo.create({
        tournamentId,
        userId,
        ageGroup: dto.ageGroup as any,
        hand: dto.hand,
        weightKg: dto.weightKg,
        notes: dto.notes ?? null,
        status: 'pending' as any,
      });
      const saved = await repo.save(entry);

      this.logger.log(
        `User ${userId} registered for tournament ${tournamentId} [${dto.ageGroup}/${dto.hand}]`,
      );

      return entryRepo.findOne({
        where: { id: (saved as any).id },
        relations: ['user', 'tournament'],
      });
    });
  }

  async cancelRegistration(
    tournamentId: string,
    entryId: string,
    userId: string,
    userRoles: string[],
  ) {
    const tournament = await this.findById(tournamentId);
    const entryRepo = this.dataSource.getRepository(TournamentEntry);
    const entry = await entryRepo.findOne({ where: { id: entryId, tournamentId } });

    if (!entry) throw new NotFoundException(`Registration #${entryId} not found`);

    const isOrganizer = tournament.organizerId === userId;
    const isAdmin = userRoles.includes('admin');
    const isOwner = (entry as any).userId === userId;

    if (!isOwner && !isOrganizer && !isAdmin) {
      throw new ForbiddenException('You can only cancel your own registration');
    }
    if (tournament.bracketGenerated) {
      throw new BadRequestException('Cannot cancel registration after bracket has been generated');
    }

    await entryRepo.update(entryId, { status: 'withdrawn' });
    this.logger.log(`Entry ${entryId} withdrawn by ${userId}`);
  }

  // ─── Close Registration + Auto Bracket Generation ────────────────────────────

  async closeRegistration(tournamentId: string, userId: string): Promise<Tournament> {
    const tournament = await this.findById(tournamentId);

    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can close registration');
    }
    if (!tournament.registrationOpen && tournament.bracketGenerated) {
      throw new BadRequestException('Bracket has already been generated');
    }

    const entryRepo = this.dataSource.getRepository(TournamentEntry);
    const bracketRepo = this.dataSource.getRepository('brackets');

    // Load all active entries with user data
    const entries: any[] = await entryRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .where('e.tournamentId = :tournamentId', { tournamentId })
      .andWhere('e.status IN (:...statuses)', { statuses: ['pending', 'confirmed'] })
      .getMany();

    if (entries.length < 2) {
      throw new BadRequestException('At least 2 registered participants are required');
    }

    // Group entries by (ageGroup, hand, weightBucket)
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

    // Merge categories with < 2 participants into the next heavier bucket
    const mergedGroups = this.mergeSmallCategories(groups);

    // Delete existing weight categories (re-generate)
    await this.weightCategoriesRepository.delete({ tournamentId });

    const brackets: any[] = [];

    for (const [, group] of mergedGroups) {
      if (group.entries.length < 2) continue;

      // Create WeightCategory record
      const ageLabel = this.ageGroupLabel(group.ageGroup);
      const handLabel = group.hand === 'right' ? 'Правая' : 'Левая';
      const catName = `${ageLabel} · ${group.bucket.label} · ${handLabel}`;

      const category = await this.weightCategoriesRepository.save(
        this.weightCategoriesRepository.create({
          tournamentId,
          name: catName,
          minWeight: group.bucket.min,
          maxWeight: group.bucket.max,
          gender: 'male',
        }),
      );

      // Link entries to this category and confirm them
      for (const entry of group.entries) {
        await entryRepo.update(entry.id, { weightCategoryId: category.id, status: 'confirmed' });
      }

      // Generate bracket
      const players: Player[] = group.entries.map((entry, idx) => ({
        id: entry.id,
        firstName: entry.user?.firstName ?? 'Player',
        lastName: entry.user?.lastName ?? String(idx + 1),
        number: idx + 1,
      }));

      const bracketData = generateDoubleElimination(players);

      const bracket = bracketRepo.create({
        tournamentId,
        weightCategoryId: category.id,
        name: catName,
        status: 'active',
        bracketData: bracketData as unknown as Record<string, unknown>,
      });
      brackets.push(await bracketRepo.save(bracket));
    }

    if (brackets.length === 0) {
      throw new BadRequestException(
        'No categories with enough participants (minimum 2 per category)',
      );
    }

    // Update tournament state
    await this.tournamentsRepository.update(tournamentId, {
      registrationOpen: false,
      bracketGenerated: true,
      status: 'bracket_ready',
    });

    this.logger.log(`Tournament ${tournamentId} closed: ${brackets.length} brackets generated`);
    return this.findById(tournamentId);
  }

  private mergeSmallCategories(
    groups: Map<
      string,
      { bucket: (typeof WEIGHT_BUCKETS)[0]; ageGroup: string; hand: string; entries: any[] }
    >,
  ) {
    // Convert to sorted array (by weight bucket index), merge <2 participant groups
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

        // Find adjacent group with same ageGroup + hand to merge into
        const nextKey = keys.find((k, j) => {
          if (j <= i) return false;
          const g = result.get(k)!;
          return g.ageGroup === group.ageGroup && g.hand === group.hand;
        });

        if (nextKey) {
          const nextGroup = result.get(nextKey)!;
          nextGroup.entries.push(...group.entries);
          result.delete(keys[i]);
          changed = true;
          break;
        } else {
          // Merge into previous
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

  private ageGroupLabel(ageGroup: string): string {
    switch (ageGroup) {
      case 'juniors':
        return 'Юниоры';
      case 'veterans':
        return 'Ветераны';
      default:
        return 'Взрослые';
    }
  }

  // ─── Operators ──────────────────────────────────────────────────────────────

  async getOperators(tournamentId: string) {
    await this.findById(tournamentId); // ensure exists
    return this.operatorsRepository.find({
      where: { tournamentId },
      relations: ['operator'],
    });
  }

  async assignOperator(
    tournamentId: string,
    operatorId: string,
    userId: string,
  ): Promise<TournamentOperator> {
    const tournament = await this.findById(tournamentId);
    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can assign operators');
    }

    const existing = await this.operatorsRepository.findOne({
      where: { tournamentId, operatorId },
    });
    if (existing) throw new ConflictException('User is already an operator for this tournament');

    const record = this.operatorsRepository.create({ tournamentId, operatorId });
    return this.operatorsRepository.save(record);
  }

  async removeOperator(tournamentId: string, operatorId: string, userId: string): Promise<void> {
    const tournament = await this.findById(tournamentId);
    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can remove operators');
    }

    const record = await this.operatorsRepository.findOne({
      where: { tournamentId, operatorId },
    });
    if (!record) throw new NotFoundException('Operator not found for this tournament');

    await this.operatorsRepository.remove(record);
    this.logger.log(`Operator ${operatorId} removed from tournament ${tournamentId}`);
  }

  async isOperator(tournamentId: string, userId: string): Promise<boolean> {
    const count = await this.operatorsRepository.count({
      where: { tournamentId, operatorId: userId },
    });
    return count > 0;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private generateSlug(name: string, date: string): string {
    const year = new Date(date).getFullYear();
    const base = name
      .toLowerCase()
      .replace(/[^a-z0-9а-яё\s]/gi, '')
      .replace(/\s+/g, '-')
      .substring(0, 60);
    return `${base}-${year}-${Date.now()}`;
  }
}
