import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RankingEntry } from './entities/ranking-entry.entity';
import { AthletesService } from '../athletes/athletes.service';
import { UpsertRankingDto } from './dto/upsert-ranking.dto';

interface FindRankingsOptions {
  sportId?: string;
  sport?: string;
  season?: number;
  country?: string;
  hand?: string;
  gender?: string;
  weightCategory?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class RankingsService {
  private logger = new Logger(RankingsService.name);

  constructor(
    @InjectRepository(RankingEntry)
    private readonly rankingsRepository: Repository<RankingEntry>,
    private readonly athletesService: AthletesService,
  ) {}

  async findWorldRankings(options: FindRankingsOptions = {}) {
    const { sport, sportId, season, hand, gender, weightCategory, page = 1, limit = 50 } = options;
    const take = Math.min(limit, 200);
    const skip = (page - 1) * take;

    const qb = this.rankingsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.athlete', 'a')
      .leftJoinAndSelect('r.sport', 'sport')
      .where('a.is_active = true')
      .orderBy('r.world_position', 'ASC', 'NULLS LAST')
      .addOrderBy('r.points', 'DESC')
      .take(take)
      .skip(skip);

    if (sportId) qb.andWhere('r.sport_id = :sportId', { sportId });
    if (sport) qb.andWhere('sport.slug = :sport', { sport });
    if (season) qb.andWhere('r.season = :season', { season });
    if (hand) qb.andWhere('r.hand = :hand', { hand });
    if (gender) qb.andWhere('r.gender = :gender', { gender });
    if (weightCategory) qb.andWhere('r.weight_category = :weightCategory', { weightCategory });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async findCountryRankings(country: string, options: FindRankingsOptions = {}) {
    const { sport, sportId, season, hand, gender, weightCategory, page = 1, limit = 50 } = options;
    const take = Math.min(limit, 200);
    const skip = (page - 1) * take;

    const qb = this.rankingsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.athlete', 'a')
      .leftJoinAndSelect('r.sport', 'sport')
      .where('r.country = :country', { country })
      .andWhere('a.is_active = true')
      .orderBy('r.country_position', 'ASC', 'NULLS LAST')
      .addOrderBy('r.points', 'DESC')
      .take(take)
      .skip(skip);

    if (sportId) qb.andWhere('r.sport_id = :sportId', { sportId });
    if (sport) qb.andWhere('sport.slug = :sport', { sport });
    if (season) qb.andWhere('r.season = :season', { season });
    if (hand) qb.andWhere('r.hand = :hand', { hand });
    if (gender) qb.andWhere('r.gender = :gender', { gender });
    if (weightCategory) qb.andWhere('r.weight_category = :weightCategory', { weightCategory });

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit: take, totalPages: Math.ceil(total / take) } };
  }

  async findByAthlete(athleteId: string, season?: number): Promise<RankingEntry[]> {
    const where: Record<string, unknown> = { athleteId };
    if (season) where['season'] = season;

    return this.rankingsRepository.find({
      where: where as any,
      relations: ['sport'],
      order: { season: 'DESC', points: 'DESC' },
    });
  }

  async findById(id: string): Promise<RankingEntry> {
    const entry = await this.rankingsRepository.findOne({
      where: { id },
      relations: ['athlete', 'sport'],
    });
    if (!entry) throw new NotFoundException(`Ranking entry #${id} not found`);
    return entry;
  }

  async upsert(dto: UpsertRankingDto): Promise<RankingEntry> {
    // Verify athlete exists
    await this.athletesService.findById(dto.athleteId);

    const existing = await this.rankingsRepository.findOne({
      where: {
        athleteId: dto.athleteId,
        sportId: dto.sportId,
        season: dto.season,
        hand: dto.hand ?? null,
        gender: dto.gender ?? null,
      } as any,
    });

    if (existing) {
      await this.rankingsRepository.update(existing.id, {
        points: dto.points,
        country: dto.country ?? existing.country,
        weightCategory: dto.weightCategory ?? existing.weightCategory,
        notes: dto.notes ?? existing.notes,
      } as any);
      this.logger.log(`Ranking updated for athlete ${dto.athleteId}, season ${dto.season}`);
      return this.findById(existing.id);
    }

    const entry = this.rankingsRepository.create({
      athleteId: dto.athleteId,
      sportId: dto.sportId,
      season: dto.season,
      points: dto.points,
      country: dto.country ?? null,
      hand: dto.hand ?? null,
      gender: dto.gender ?? null,
      weightCategory: dto.weightCategory ?? null,
      notes: dto.notes ?? null,
    });

    const saved = await this.rankingsRepository.save(entry);
    this.logger.log(`Ranking created for athlete ${dto.athleteId}, season ${dto.season}`);
    return this.findById(saved.id);
  }

  /**
   * Recalculates worldPosition and countryPosition for all entries
   * in a given sport + season combination, partitioned by (hand, gender, weightCategory).
   * Call after bulk point updates.
   */
  async recalculate(sportId: string, season: number): Promise<void> {
    const entries = await this.rankingsRepository.find({
      where: { sportId, season } as any,
      relations: ['athlete'],
      order: { points: 'DESC' },
    });

    // Group entries by partition key: (hand, gender, weightCategory)
    const partitions = new Map<string, RankingEntry[]>();
    for (const entry of entries) {
      const key = `${entry.hand ?? ''}|${entry.gender ?? ''}|${entry.weightCategory ?? ''}`;
      const list = partitions.get(key) ?? [];
      list.push(entry);
      partitions.set(key, list);
    }

    // Per partition: assign worldPosition, then countryPosition
    for (const [, partitionEntries] of partitions) {
      // partitionEntries already sorted by points DESC from the main query
      let worldPos = 1;
      for (const entry of partitionEntries) {
        await this.rankingsRepository.update(entry.id, { worldPosition: worldPos });
        entry.worldPosition = worldPos;
        worldPos++;
      }

      // Country ranking within this partition
      const byCountry = new Map<string, RankingEntry[]>();
      for (const entry of partitionEntries) {
        if (!entry.country) continue;
        const list = byCountry.get(entry.country) ?? [];
        list.push(entry);
        byCountry.set(entry.country, list);
      }
      for (const [, countryEntries] of byCountry) {
        let countryPos = 1;
        for (const entry of countryEntries) {
          await this.rankingsRepository.update(entry.id, { countryPosition: countryPos++ });
        }
      }
    }

    // Sync cached worldRank + totalPoints on the Athlete entity
    for (const entry of entries) {
      await this.athletesService.updateRankingCache(entry.athleteId, {
        worldRank: entry.worldPosition,
        totalPoints: entry.points,
      });
    }

    this.logger.log(
      `Rankings recalculated: sport=${sportId}, season=${season}, ${entries.length} entries, ${partitions.size} partitions`,
    );
  }
}
