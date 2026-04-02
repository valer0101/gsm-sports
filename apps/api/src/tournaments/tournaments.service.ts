import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tournament } from './entities/tournament.entity';
import { WeightCategory } from './entities/weight-category.entity';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

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
  ) {}

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

    return {
      data,
      meta: { total, page, limit: take, totalPages: Math.ceil(total / take) },
    };
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

    await this.tournamentsRepository.update(id, {
      registrationOpen: !tournament.registrationOpen,
    });
    return this.findById(id);
  }

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
