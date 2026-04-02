import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Sport } from './entities/sport.entity';
import { CreateSportDto } from './dto/create-sport.dto';

@Injectable()
export class SportsService {
  private logger = new Logger(SportsService.name);

  constructor(
    @InjectRepository(Sport)
    private readonly sportsRepository: Repository<Sport>,
  ) {}

  async findAll(): Promise<Sport[]> {
    return this.sportsRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', nameEn: 'ASC' },
    });
  }

  async findBySlug(slug: string): Promise<Sport> {
    const sport = await this.sportsRepository.findOne({ where: { slug } });
    if (!sport) throw new NotFoundException(`Sport '${slug}' not found`);
    return sport;
  }

  async findById(id: number): Promise<Sport> {
    const sport = await this.sportsRepository.findOne({ where: { id } });
    if (!sport) throw new NotFoundException(`Sport #${id} not found`);
    return sport;
  }

  async create(dto: CreateSportDto): Promise<Sport> {
    const existing = await this.sportsRepository.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Sport with slug '${dto.slug}' already exists`);

    const sport = this.sportsRepository.create(dto);
    const saved = await this.sportsRepository.save(sport);
    this.logger.log(`Sport created: ${saved.slug}`);
    return saved;
  }

  async update(id: number, dto: Partial<CreateSportDto>): Promise<Sport> {
    await this.findById(id);
    await this.sportsRepository.update(id, dto as any);
    return this.findById(id);
  }

  async seed(): Promise<void> {
    const count = await this.sportsRepository.count();
    if (count > 0) return;

    await this.sportsRepository.save([
      {
        slug: 'armwrestling',
        nameRu: 'Армрестлинг',
        nameEn: 'Armwrestling',
        nameHy: 'Ձեռնամարտ',
        sortOrder: 1,
        config: { hands: ['left', 'right', 'both'] },
      },
    ]);
    this.logger.log('Sports seeded');
  }
}
