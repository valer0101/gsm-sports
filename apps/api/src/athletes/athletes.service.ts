import {
  Injectable,
  Logger,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Athlete } from './entities/athlete.entity';
import { CreateAthleteDto } from './dto/create-athlete.dto';

interface FindAllOptions {
  sport?: string;
  country?: string;
  gender?: string;
  hand?: string;
  search?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class AthletesService {
  private logger = new Logger(AthletesService.name);

  constructor(
    @InjectRepository(Athlete)
    private readonly athletesRepository: Repository<Athlete>,
  ) {}

  async findAll(options: FindAllOptions = {}) {
    const { sport, country, gender, hand, search, page = 1, limit = 20 } = options;
    const take = Math.min(limit, 100);
    const skip = (page - 1) * take;

    const qb = this.athletesRepository
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.sport', 'sport')
      .leftJoinAndSelect('a.user', 'user')
      .where('a.is_active = true')
      .orderBy('a.world_rank', 'ASC', 'NULLS LAST')
      .addOrderBy('a.total_points', 'DESC')
      .take(take)
      .skip(skip);

    if (sport) qb.andWhere('sport.slug = :sport', { sport });
    if (country) qb.andWhere('a.country = :country', { country });
    if (gender) qb.andWhere('a.gender = :gender', { gender });
    if (hand) qb.andWhere('a.primary_hand = :hand', { hand });
    if (search) {
      qb.andWhere(
        "(a.first_name ILIKE :search OR a.last_name ILIKE :search OR CONCAT(a.first_name, ' ', a.last_name) ILIKE :search)",
        { search: `%${search}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async findBySlug(slug: string): Promise<Athlete> {
    const athlete = await this.athletesRepository.findOne({
      where: { slug },
      relations: ['sport', 'user'],
    });
    if (!athlete) throw new NotFoundException(`Athlete '${slug}' not found`);
    return athlete;
  }

  async findById(id: string): Promise<Athlete> {
    const athlete = await this.athletesRepository.findOne({
      where: { id },
      relations: ['sport', 'user'],
    });
    if (!athlete) throw new NotFoundException(`Athlete #${id} not found`);
    return athlete;
  }

  async findByUserId(userId: string): Promise<Athlete[]> {
    return this.athletesRepository.find({
      where: { userId },
      relations: ['sport'],
    });
  }

  async create(dto: CreateAthleteDto, creatorUserId: string): Promise<Athlete> {
    const slug = this.generateSlug(dto.firstName, dto.lastName);

    // If linking to a user, ensure no duplicate athlete per sport per user
    if (dto.userId) {
      const existing = await this.athletesRepository.findOne({
        where: { userId: dto.userId, sportId: dto.sportId },
      });
      if (existing) {
        throw new ConflictException('Athlete profile for this user and sport already exists');
      }
    }

    const athlete = this.athletesRepository.create({
      ...dto,
      slug,
      userId: dto.userId ?? null,
      gender: dto.gender as any,
      primaryHand: dto.primaryHand as any,
      experienceLevel: dto.experienceLevel as any,
      dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : null,
    });

    const saved = (await this.athletesRepository.save(athlete)) as Athlete;
    this.logger.log(
      `Athlete profile created: ${saved.firstName} ${saved.lastName} (${saved.id}) by ${creatorUserId}`,
    );
    return this.findById(saved.id);
  }

  async update(id: string, dto: Partial<CreateAthleteDto>, userId: string): Promise<Athlete> {
    const athlete = await this.findById(id);

    if (athlete.userId !== userId) {
      throw new ForbiddenException('You can only update your own athlete profile');
    }

    const updateData: Record<string, unknown> = { ...dto };
    if (dto.dateOfBirth) updateData['dateOfBirth'] = new Date(dto.dateOfBirth);

    await this.athletesRepository.update(id, updateData as any);
    return this.findById(id);
  }

  async verify(id: string): Promise<Athlete> {
    await this.findById(id);
    await this.athletesRepository.update(id, { isVerified: true });
    this.logger.log(`Athlete ${id} verified`);
    return this.findById(id);
  }

  async updateRankingCache(
    id: string,
    data: { worldRank?: number | null; countryRank?: number | null; totalPoints?: number },
  ): Promise<void> {
    await this.athletesRepository.update(id, data as any);
  }

  private generateSlug(firstName: string, lastName: string): string {
    const base = `${firstName} ${lastName}`
      .toLowerCase()
      .replace(/[^a-z0-9а-яёa-zA-ZА-ЯЁа-яё\s]/gi, '')
      .replace(/\s+/g, '-')
      .substring(0, 80);
    return `${base}-${Date.now()}`;
  }
}
