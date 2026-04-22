import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { SportConfig } from '@gsm/shared-types';
import { Sport } from './entities/sport.entity';
import { CreateSportDto } from './dto/create-sport.dto';
import { UpdateSportDto } from './dto/update-sport.dto';
import { resolveSportConfig, SPORT_CONFIG_PRESETS } from './sport-config';

/** Sport returned to API consumers with config always fully populated. */
export type SportWithResolvedConfig = Omit<Sport, 'config'> & { config: SportConfig };

function withResolvedConfig(sport: Sport): SportWithResolvedConfig {
  return {
    ...sport,
    config: resolveSportConfig(sport.slug, sport.config as Partial<SportConfig>),
  };
}

@Injectable()
export class SportsService {
  private logger = new Logger(SportsService.name);

  constructor(
    @InjectRepository(Sport)
    private readonly sportsRepository: Repository<Sport>,
  ) {}

  async findAll(options: { page?: number; limit?: number } = {}): Promise<{
    data: SportWithResolvedConfig[];
    meta: { total: number; page: number; limit: number; totalPages: number };
  }> {
    const page = options.page ?? 1;
    const limit = Math.min(options.limit ?? 50, 100);
    const skip = (page - 1) * limit;

    const [data, total] = await this.sportsRepository.findAndCount({
      where: { isActive: true },
      order: { sortOrder: 'ASC', nameEn: 'ASC' },
      take: limit,
      skip,
    });

    return {
      data: data.map(withResolvedConfig),
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findBySlug(slug: string): Promise<SportWithResolvedConfig> {
    const sport = await this.sportsRepository.findOne({ where: { slug } });
    if (!sport) throw new NotFoundException(`Sport '${slug}' not found`);
    return withResolvedConfig(sport);
  }

  async findById(id: string): Promise<SportWithResolvedConfig> {
    const sport = await this.sportsRepository.findOne({ where: { id } });
    if (!sport) throw new NotFoundException(`Sport #${id} not found`);
    return withResolvedConfig(sport);
  }

  /** Raw entity (no config resolution) — used internally when linking from other services. */
  async findRawById(id: string): Promise<Sport> {
    const sport = await this.sportsRepository.findOne({ where: { id } });
    if (!sport) throw new NotFoundException(`Sport #${id} not found`);
    return sport;
  }

  async create(dto: CreateSportDto): Promise<SportWithResolvedConfig> {
    const existing = await this.sportsRepository.findOne({ where: { slug: dto.slug } });
    if (existing) throw new ConflictException(`Sport with slug '${dto.slug}' already exists`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sport = this.sportsRepository.create(dto as any) as unknown as Sport;
    const saved = await this.sportsRepository.save(sport);
    this.logger.log(`Sport created: ${saved.slug}`);
    return withResolvedConfig(saved);
  }

  async update(id: string, dto: UpdateSportDto): Promise<SportWithResolvedConfig> {
    const existing = await this.findRawById(id);

    // Allow partial config merges — callers may send only a subset.
    const patch: Partial<Sport> = { ...(dto as Partial<Sport>) };
    if (dto.config !== undefined) {
      patch.config = {
        ...((existing.config as Record<string, unknown>) ?? {}),
        ...(dto.config as Record<string, unknown>),
      };
    }

    await this.sportsRepository.update(id, patch as any);
    return this.findById(id);
  }

  /**
   * Seed initial sports AND backfill missing config fields on existing rows so
   * consumers always see the current defaults. Safe to run repeatedly.
   */
  async seed(): Promise<void> {
    const count = await this.sportsRepository.count();

    if (count === 0) {
      const rows = Object.entries(SPORT_CONFIG_PRESETS).map(([slug, preset]) => ({
        slug,
        nameRu: slug,
        nameEn: slug,
        nameHy: slug,
        sortOrder: 0,
        config: preset as Record<string, unknown>,
      }));

      // Keep the nicer Russian/Armenian names for armwrestling since that's the
      // only sport we currently ship localised names for.
      const arm = rows.find((r) => r.slug === 'armwrestling');
      if (arm) {
        arm.nameRu = 'Армрестлинг';
        arm.nameEn = 'Armwrestling';
        arm.nameHy = 'Ձեռնամարտ';
        arm.sortOrder = 1;
      }

      await this.sportsRepository.save(rows);
      this.logger.log(`Sports seeded (${rows.length})`);
      return;
    }

    // Backfill: for each existing sport, merge preset defaults into missing config keys.
    const all = await this.sportsRepository.find();
    for (const sport of all) {
      const preset = SPORT_CONFIG_PRESETS[sport.slug] ?? {};
      const current = (sport.config as Record<string, unknown>) ?? {};
      const merged: Record<string, unknown> = { ...preset, ...current };
      const changed = JSON.stringify(merged) !== JSON.stringify(current);
      if (changed) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await this.sportsRepository.update(sport.id, { config: merged } as any);
        this.logger.log(`Sport '${sport.slug}' config backfilled with preset defaults`);
      }
    }
  }
}
