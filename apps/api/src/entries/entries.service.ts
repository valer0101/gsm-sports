import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TournamentEntry, EntryStatus } from './entities/tournament-entry.entity';
import { TournamentsService } from '../tournaments/tournaments.service';
import { CreateEntryDto } from './dto/create-entry.dto';

@Injectable()
export class EntriesService {
  private logger = new Logger(EntriesService.name);

  constructor(
    @InjectRepository(TournamentEntry)
    private readonly entriesRepository: Repository<TournamentEntry>,
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
        const count = await repo.count({
          where: { tournamentId: dto.tournamentId, status: 'confirmed' as EntryStatus },
        });
        if (count >= tournament.maxParticipants) {
          throw new BadRequestException('Tournament is full');
        }
      }

      const entry = repo.create({
        tournamentId: dto.tournamentId,
        userId,
        weightCategoryId: dto.weightCategoryId ?? null,
        hand: dto.hand ?? null,
        registeredWeight: dto.registeredWeight ?? null,
        notes: dto.notes ?? null,
        status: 'pending' as EntryStatus,
      });
      return repo.save(entry);
    });

    this.logger.log(`User ${userId} registered for tournament ${dto.tournamentId}`);
    return this.findById(saved.id);
  }

  async findById(id: string): Promise<TournamentEntry> {
    const entry = await this.entriesRepository.findOne({
      where: { id },
      relations: ['user', 'tournament', 'weightCategory'],
    });
    if (!entry) throw new NotFoundException(`Entry #${id} not found`);
    return entry;
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
    const take = Math.min(limit, 200);
    const skip = (page - 1) * take;

    const qb = this.entriesRepository
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.user', 'user')
      .leftJoinAndSelect('e.weightCategory', 'wc')
      .where('e.tournament_id = :tournamentId', { tournamentId })
      .orderBy('e.created_at', 'ASC')
      .take(take)
      .skip(skip);

    if (status) qb.andWhere('e.status = :status', { status });
    if (weightCategoryId)
      qb.andWhere('e.weight_category_id = :weightCategoryId', { weightCategoryId });

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
      .andWhere('e.tournament_id = :tournamentId', { tournamentId })
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
