import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { TournamentEntry, EntryStatus } from './entities/tournament-entry.entity';
import { User } from '../users/entities/user.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { TournamentsService } from '../tournaments/tournaments.service';
import { fitsWeightCategory } from '../tournaments/weight-category.util';
import { CreateEntryDto } from './dto/create-entry.dto';

@Injectable()
export class EntriesService {
  private logger = new Logger(EntriesService.name);

  constructor(
    @InjectRepository(TournamentEntry)
    private readonly entriesRepository: Repository<TournamentEntry>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(WeightCategory)
    private readonly weightCategoriesRepository: Repository<WeightCategory>,
    @Inject(forwardRef(() => TournamentsService))
    private readonly tournamentsService: TournamentsService,
  ) {}

  async register(dto: CreateEntryDto, userId: string): Promise<TournamentEntry> {
    const tournament = await this.tournamentsService.findById(dto.tournamentId);

    if (!tournament.registrationOpen) {
      throw new BadRequestException('Registration is closed for this tournament');
    }

    if (tournament.registrationDeadline && new Date() > tournament.registrationDeadline) {
      throw new BadRequestException('Registration deadline has passed');
    }

    if (dto.weightCategoryId) {
      const category = await this.weightCategoriesRepository.findOne({
        where: { id: dto.weightCategoryId, tournamentId: dto.tournamentId },
      });
      if (!category) {
        throw new BadRequestException('Weight category does not belong to this tournament');
      }
      if (dto.weightKg !== undefined && !fitsWeightCategory(dto.weightKg, category)) {
        const tol = Number(category.weightToleranceKg ?? 0);
        const limit =
          category.maxWeight !== null ? Number(category.maxWeight) + tol : null;
        throw new BadRequestException(
          limit !== null
            ? `Weight ${dto.weightKg} kg exceeds category limit (${limit} kg incl. tolerance)`
            : `Weight ${dto.weightKg} kg does not fit category "${category.name}"`,
        );
      }
    }

    // Snapshot the registrant's country so historical leaderboards are
    // stable if the user later edits their profile (Phase 3.4).
    const user = await this.usersRepository.findOne({
      where: { id: userId },
      select: ['id', 'country'],
    });
    const athleteCountry = user?.country ?? null;

    // Capacity check + insert in a transaction to prevent race conditions
    const saved = await this.entriesRepository.manager.transaction(async (em) => {
      const repo = em.getRepository(TournamentEntry);

      const existing = await repo.findOne({
        where: { tournamentId: dto.tournamentId, userId },
      });
      if (existing) {
        throw new ConflictException('You are already registered for this tournament');
      }

      if (tournament.maxParticipants) {
        const count = await repo
          .createQueryBuilder('e')
          .where('e.tournamentId = :tournamentId', { tournamentId: dto.tournamentId })
          .andWhere('e.status != :withdrawn', { withdrawn: 'withdrawn' })
          .getCount();
        if (count >= tournament.maxParticipants) {
          throw new BadRequestException('Tournament is full');
        }
      }

      const entry = repo.create({
        tournamentId: dto.tournamentId,
        userId,
        ageGroup: dto.ageGroup ?? null,
        weightCategoryId: dto.weightCategoryId ?? null,
        hand: dto.hand ?? null,
        weightKg: dto.weightKg ?? null,
        notes: dto.notes ?? null,
        athleteCountry,
        status: 'pending' as EntryStatus,
      });
      return repo.save(entry);
    });

    this.logger.log(`User ${userId} registered for tournament ${dto.tournamentId}`);
    return this.findById((saved as TournamentEntry).id);
  }

  async findById(id: string): Promise<TournamentEntry> {
    const entry = await this.entriesRepository.findOne({
      where: { id },
      relations: ['user', 'tournament', 'tournament.sport', 'weightCategory'],
    });
    if (!entry) throw new NotFoundException(`Entry #${id} not found`);
    return entry;
  }

  /**
   * Bulk fetch entries by id. Does NOT throw if some ids are missing —
   * callers can diff against the returned array. Used by the start-category
   * / auto-forfeit flow to check `status === 'checked_in'` in a single round
   * trip instead of a query per slot.
   */
  async findByIds(ids: string[]): Promise<TournamentEntry[]> {
    if (ids.length === 0) return [];
    return this.entriesRepository.find({ where: { id: In(ids) } });
  }

  async findByTournament(
    tournamentId: string,
    options: {
      status?: EntryStatus;
      weightCategoryId?: string;
      page?: number;
      limit?: number;
    } = {},
  ) {
    const { status, weightCategoryId, page = 1, limit = 50 } = options;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const qb = this.entriesRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .leftJoinAndSelect('e.weightCategory', 'wc')
      .where('e.tournamentId = :tournamentId', { tournamentId })
      .orderBy('e.createdAt', 'ASC')
      .take(take)
      .skip(skip);

    if (status) qb.andWhere('e.status = :status', { status });
    if (weightCategoryId)
      qb.andWhere('e.weightCategoryId = :weightCategoryId', { weightCategoryId });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async findByUser(userId: string) {
    return this.entriesRepository.find({
      where: { userId },
      relations: ['tournament', 'weightCategory'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateStatus(
    id: string,
    status: EntryStatus,
    organizerId: string,
  ): Promise<TournamentEntry> {
    const entry = await this.findById(id);

    if (entry.tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Only the organizer can update entry status');
    }

    await this.entriesRepository.update(id, { status });
    this.logger.log(`Entry ${id} status updated to ${status} by ${organizerId}`);
    return this.findById(id);
  }

  async withdraw(id: string, userId: string): Promise<TournamentEntry> {
    const entry = await this.findById(id);

    if (entry.userId !== userId) {
      throw new ForbiddenException('You can only withdraw your own entry');
    }

    if (entry.status === 'withdrawn') {
      throw new BadRequestException('Entry is already withdrawn');
    }

    await this.entriesRepository.update(id, { status: 'withdrawn' });
    return this.findById(id);
  }

  async findByGroup(
    tournamentId: string,
    ageGroup: string,
    hand: string,
  ): Promise<TournamentEntry[]> {
    const qb = this.entriesRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .where('e.tournamentId = :tournamentId', { tournamentId })
      .andWhere('e.status = :status', { status: 'confirmed' })
      .orderBy('e.createdAt', 'ASC');

    if (ageGroup) qb.andWhere('e.ageGroup = :ageGroup', { ageGroup });
    if (hand) qb.andWhere('e.hand = :hand', { hand });

    return qb.getMany();
  }

  /**
   * Reassign an entry to a different weight category / age group / hand / weight.
   * Only allowed BEFORE the tournament bracket has been generated — once the
   * bracket exists, use the bracket slot-replace endpoint instead (otherwise
   * the sorted bracket would silently become inconsistent with the entry).
   *
   * Access: admin or tournament organizer.
   */
  async reassign(
    id: string,
    patch: {
      weightCategoryId?: string | null;
      ageGroup?: 'juniors' | 'adults' | 'veterans';
      hand?: 'left' | 'right';
      weightKg?: number;
      reason: string;
    },
    actor: { userId: string; roles: string[] },
  ): Promise<TournamentEntry> {
    const entry = await this.findById(id);
    const isAdmin = actor.roles.includes('admin');
    const isOrganizer = entry.tournament.organizerId === actor.userId;

    if (!isAdmin && !isOrganizer) {
      throw new ForbiddenException('Only admin or tournament organizer can reassign entries');
    }

    if (entry.tournament.bracketGenerated) {
      throw new BadRequestException(
        'Bracket has already been generated — use bracket slot replacement instead',
      );
    }

    const update: Record<string, unknown> = {};
    if (patch.weightCategoryId !== undefined) update.weightCategoryId = patch.weightCategoryId;
    if (patch.ageGroup !== undefined) update.ageGroup = patch.ageGroup;
    if (patch.hand !== undefined) update.hand = patch.hand;
    if (patch.weightKg !== undefined) update.weightKg = patch.weightKg;

    if (Object.keys(update).length === 0) {
      throw new BadRequestException('No fields to update');
    }

    const appendedNote = `[reassign by ${actor.userId} @ ${new Date().toISOString()}] ${patch.reason}`;
    update.notes = entry.notes ? `${entry.notes}\n${appendedNote}` : appendedNote;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await this.entriesRepository.update(id, update as any);
    this.logger.log(`Entry ${id} reassigned by ${actor.userId}: ${patch.reason}`);
    return this.findById(id);
  }

  async setSeedNumbers(
    tournamentId: string,
    seeds: { entryId: string; seed: number }[],
    organizerId: string,
  ): Promise<void> {
    const tournament = await this.tournamentsService.findById(tournamentId);

    if (tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Only the organizer can set seed numbers');
    }

    if (seeds.length === 0) return;

    // Verify all entries belong to this tournament
    const entryIds = seeds.map((s) => s.entryId);
    const matchingCount = await this.entriesRepository
      .createQueryBuilder('e')
      .where('e.id IN (:...ids)', { ids: entryIds })
      .andWhere('e.tournamentId = :tournamentId', { tournamentId })
      .getCount();

    if (matchingCount !== entryIds.length) {
      throw new BadRequestException('One or more entries do not belong to this tournament');
    }

    await Promise.all(
      seeds.map(({ entryId, seed }) =>
        this.entriesRepository.update(entryId, { seedNumber: seed }),
      ),
    );
  }
}
