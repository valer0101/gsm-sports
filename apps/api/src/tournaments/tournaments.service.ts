import {
  Injectable,
  Logger,
  Inject,
  forwardRef,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tournament } from './entities/tournament.entity';
import { WeightCategory } from './entities/weight-category.entity';
import { TournamentOperator } from './entities/tournament-operator.entity';
import { TournamentTable } from './entities/tournament-table.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { User } from '../users/entities/user.entity';
import { BracketsService } from '../brackets/brackets.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { fitsWeightCategory } from './weight-category.util';

interface FindAllOptions {
  sport?: string;
  status?: string;
  country?: string;
  page?: number;
  limit?: number;
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
    @InjectRepository(TournamentTable)
    private readonly tablesRepository: Repository<TournamentTable>,
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => BracketsService))
    private readonly bracketsService: BracketsService,
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
    const take = Math.min(limit, 100);
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
    dto: {
      ageGroup: string;
      hand: string;
      weightKg: number;
      weightCategoryId?: string;
      notes?: string;
    },
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

    // Tolerance check — if the registrant picked a weight category, their
    // weight must fit `(min, max + weightToleranceKg]`. Without an explicit
    // pick we leave assignment to the bracket-generation auto-bucket pass.
    let resolvedWeightCategoryId: string | null = dto.weightCategoryId ?? null;
    if (dto.weightCategoryId) {
      const category = await this.weightCategoriesRepository.findOne({
        where: { id: dto.weightCategoryId, tournamentId },
      });
      if (!category) {
        throw new BadRequestException('Weight category does not belong to this tournament');
      }
      if (!fitsWeightCategory(dto.weightKg, category)) {
        const tol = Number(category.weightToleranceKg ?? 0);
        const limit = category.maxWeight !== null ? Number(category.maxWeight) + tol : null;
        throw new BadRequestException(
          limit !== null
            ? `Weight ${dto.weightKg} kg exceeds category limit (${limit} kg incl. tolerance)`
            : `Weight ${dto.weightKg} kg does not fit category "${category.name}"`,
        );
      }
      resolvedWeightCategoryId = category.id;
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
        const count = await repo
          .createQueryBuilder('e')
          .where('e.tournamentId = :tournamentId', { tournamentId })
          .andWhere('e.status != :withdrawn', { withdrawn: 'withdrawn' })
          .getCount();
        if (count >= tournament.maxParticipants) {
          throw new BadRequestException('Tournament is full');
        }
      }

      // Snapshot country at registration so post-event profile edits don't
      // shift historical team-standings (Phase 3.4). Read inside the
      // transaction for consistency with the entry write.
      const userRow = await em.getRepository(User).findOne({
        where: { id: userId },
        select: ['id', 'country'],
      });
      const athleteCountry = userRow?.country ?? null;

      const newEntry = repo.create({
        tournamentId,
        userId,
        ageGroup: dto.ageGroup as any,
        hand: dto.hand,
        weightKg: dto.weightKg,
        weightCategoryId: resolvedWeightCategoryId,
        notes: dto.notes ?? null,
        athleteCountry,
        status: 'pending' as any,
      });
      const saved = await repo.save(newEntry);

      this.logger.log(
        `User ${userId} registered for tournament ${tournamentId} [${dto.ageGroup}/${dto.hand}]`,
      );

      const entry = await entryRepo.findOne({
        where: { id: (saved as any).id },
        relations: ['user', 'tournament'],
      });
      if (!entry) throw new NotFoundException('Entry not found after creation');
      return entry;
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

    const bracketCount = await this.bracketsService.generateWithWeightBuckets(tournamentId);
    this.logger.log(`Tournament ${tournamentId} closed: ${bracketCount} brackets generated`);
    return this.findById(tournamentId);
  }

  // ─── Operators ──────────────────────────────────────────────────────────────

  async getOperators(tournamentId: string) {
    await this.findById(tournamentId); // ensure exists
    return this.operatorsRepository.find({
      where: { tournamentId },
      relations: ['operator', 'table'],
    });
  }

  async assignOperator(
    tournamentId: string,
    operatorId: string,
    userId: string,
    tableId?: string | null,
  ): Promise<TournamentOperator> {
    const tournament = await this.findById(tournamentId);
    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can assign operators');
    }

    if (tableId) {
      const table = await this.tablesRepository.findOne({
        where: { id: tableId, tournamentId },
      });
      if (!table) {
        throw new BadRequestException('Table does not belong to this tournament');
      }
    }

    const existing = await this.operatorsRepository.findOne({
      where: { tournamentId, operatorId },
    });
    if (existing) throw new ConflictException('User is already an operator for this tournament');

    const record = this.operatorsRepository.create({
      tournamentId,
      operatorId,
      tableId: tableId ?? null,
    });
    return this.operatorsRepository.save(record);
  }

  async updateOperatorTable(
    tournamentId: string,
    operatorId: string,
    tableId: string | null,
    userId: string,
  ): Promise<TournamentOperator> {
    const tournament = await this.findById(tournamentId);
    if (tournament.organizerId !== userId) {
      throw new ForbiddenException('Only the organizer can reassign operators');
    }

    const record = await this.operatorsRepository.findOne({
      where: { tournamentId, operatorId },
    });
    if (!record) throw new NotFoundException('Operator not found for this tournament');

    if (tableId) {
      const table = await this.tablesRepository.findOne({
        where: { id: tableId, tournamentId },
      });
      if (!table) {
        throw new BadRequestException('Table does not belong to this tournament');
      }
    }

    record.tableId = tableId;
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
