import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { RankingsService } from './rankings.service';
import { RankingEntry } from './entities/ranking-entry.entity';
import { AthletesService } from '../athletes/athletes.service';

const makeQb = (result: [RankingEntry[], number] = [[], 0]) => ({
  leftJoinAndSelect: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  andWhere: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  addOrderBy: vi.fn().mockReturnThis(),
  take: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  getManyAndCount: vi.fn().mockResolvedValue(result),
});

const makeTransactionManager = () => ({
  update: vi.fn().mockResolvedValue(undefined),
});

const mockRepo = () => {
  const emUpdate = vi.fn().mockResolvedValue(undefined);
  return {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    createQueryBuilder: vi.fn(),
    manager: {
      transaction: vi.fn().mockImplementation(async (cb: (em: any) => Promise<void>) => {
        await cb({ update: emUpdate });
      }),
      _emUpdate: emUpdate, // exposed for assertions
    },
  };
};

const mockAthletesService = () => ({
  findById: vi.fn(),
  updateRankingCache: vi.fn(),
});

const makeEntry = (overrides = {}): RankingEntry => ({
  id: 'entry-uuid-1',
  athleteId: 'athlete-uuid-1',
  sportId: 'sport-uuid-1',
  season: 2025,
  points: 500,
  country: 'Armenia',
  hand: 'right',
  gender: 'male',
  weightCategory: 'до 70 кг',
  worldPosition: 1,
  countryPosition: 1,
  notes: null,
  athlete: null as any,
  sport: null as any,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('RankingsService', () => {
  let service: RankingsService;
  let repo: ReturnType<typeof mockRepo>;
  let athletesService: ReturnType<typeof mockAthletesService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RankingsService,
        { provide: getRepositoryToken(RankingEntry), useFactory: mockRepo },
        { provide: AthletesService, useFactory: mockAthletesService },
      ],
    }).compile();

    service = module.get(RankingsService);
    repo = module.get(getRepositoryToken(RankingEntry));
    athletesService = module.get(AthletesService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findWorldRankings', () => {
    it('should return paginated world rankings', async () => {
      const entries = [makeEntry()];
      const qb = makeQb([entries, 1]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findWorldRankings();
      expect(result.data).toEqual(entries);
      expect(result.meta.total).toBe(1);
    });

    it('should apply hand filter', async () => {
      const qb = makeQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findWorldRankings({ hand: 'left' });
      expect(qb.andWhere).toHaveBeenCalledWith('r.hand = :hand', { hand: 'left' });
    });

    it('should apply gender filter', async () => {
      const qb = makeQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findWorldRankings({ gender: 'female' });
      expect(qb.andWhere).toHaveBeenCalledWith('r.gender = :gender', { gender: 'female' });
    });

    it('should apply season filter', async () => {
      const qb = makeQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findWorldRankings({ season: 2025 });
      expect(qb.andWhere).toHaveBeenCalledWith('r.season = :season', { season: 2025 });
    });

    it('should cap limit at 100', async () => {
      const qb = makeQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findWorldRankings({ limit: 999 });
      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });

  describe('findCountryRankings', () => {
    it('should return country rankings filtered by country', async () => {
      const entries = [makeEntry()];
      const qb = makeQb([entries, 1]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findCountryRankings('Armenia');
      expect(qb.where).toHaveBeenCalledWith('r.country = :country', { country: 'Armenia' });
      expect(result.data).toEqual(entries);
    });
  });

  describe('findByAthlete', () => {
    it('should return all ranking entries for an athlete', async () => {
      const entries = [makeEntry()];
      repo.find.mockResolvedValue(entries);

      const result = await service.findByAthlete('athlete-uuid-1');
      expect(result).toEqual(entries);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ athleteId: 'athlete-uuid-1' }),
        }),
      );
    });

    it('should filter by season when provided', async () => {
      repo.find.mockResolvedValue([]);
      await service.findByAthlete('athlete-uuid-1', 2025);
      expect(repo.find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ season: 2025 }) }),
      );
    });
  });

  describe('findById', () => {
    it('should return ranking entry by id', async () => {
      const entry = makeEntry();
      repo.findOne.mockResolvedValue(entry);
      const result = await service.findById('entry-uuid-1');
      expect(result).toEqual(entry);
    });

    it('should throw NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('upsert', () => {
    const dto = {
      athleteId: 'athlete-uuid-1',
      sportId: 'sport-uuid-1',
      season: 2025,
      points: 500,
      country: 'Armenia',
      hand: 'right' as const,
      gender: 'male' as const,
    };

    it('should create new entry when none exists', async () => {
      athletesService.findById.mockResolvedValue({ id: 'athlete-uuid-1' });
      repo.findOne.mockResolvedValueOnce(null); // no existing
      const entry = makeEntry();
      repo.create.mockReturnValue(entry);
      repo.save.mockResolvedValue(entry);
      repo.findOne.mockResolvedValueOnce(entry); // findById

      const result = await service.upsert(dto);
      expect(repo.create).toHaveBeenCalled();
      expect(repo.save).toHaveBeenCalled();
      expect(result.points).toBe(500);
    });

    it('should update existing entry when duplicate key', async () => {
      athletesService.findById.mockResolvedValue({ id: 'athlete-uuid-1' });
      const existing = makeEntry({ id: 'existing-entry-id' });
      repo.findOne.mockResolvedValueOnce(existing); // duplicate found
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(makeEntry({ points: 600 })); // findById

      const result = await service.upsert({ ...dto, points: 600 });
      expect(repo.update).toHaveBeenCalledWith(
        'existing-entry-id',
        expect.objectContaining({ points: 600 }),
      );
    });

    it('should throw NotFoundException if athlete does not exist', async () => {
      athletesService.findById.mockRejectedValue(new NotFoundException());
      await expect(service.upsert(dto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('recalculate', () => {
    it('should assign world positions by points descending', async () => {
      const entries = [
        makeEntry({ id: 'e1', athleteId: 'a1', points: 500, country: 'Armenia' }),
        makeEntry({ id: 'e2', athleteId: 'a2', points: 300, country: 'Armenia' }),
        makeEntry({ id: 'e3', athleteId: 'a3', points: 100, country: 'Russia' }),
      ];
      repo.find.mockResolvedValue(entries);
      athletesService.updateRankingCache.mockResolvedValue(undefined);

      await service.recalculate('sport-uuid-1', 2025);

      // em.update is called inside the transaction with RankingEntry class + id + payload
      const emUpdate = repo.manager._emUpdate;
      expect(emUpdate).toHaveBeenCalledWith(expect.anything(), 'e1', { worldPosition: 1 });
      expect(emUpdate).toHaveBeenCalledWith(expect.anything(), 'e2', { worldPosition: 2 });
      expect(emUpdate).toHaveBeenCalledWith(expect.anything(), 'e3', { worldPosition: 3 });
    });

    it('should assign country positions per country', async () => {
      const entries = [
        makeEntry({ id: 'e1', athleteId: 'a1', points: 500, country: 'Armenia' }),
        makeEntry({ id: 'e2', athleteId: 'a2', points: 300, country: 'Armenia' }),
        makeEntry({ id: 'e3', athleteId: 'a3', points: 100, country: 'Russia' }),
      ];
      repo.find.mockResolvedValue(entries);
      athletesService.updateRankingCache.mockResolvedValue(undefined);

      await service.recalculate('sport-uuid-1', 2025);

      const emUpdate = repo.manager._emUpdate;
      expect(emUpdate).toHaveBeenCalledWith(expect.anything(), 'e1', { countryPosition: 1 });
      expect(emUpdate).toHaveBeenCalledWith(expect.anything(), 'e2', { countryPosition: 2 });
      expect(emUpdate).toHaveBeenCalledWith(expect.anything(), 'e3', { countryPosition: 1 });
    });

    it('should sync cached worldRank on athlete entities', async () => {
      const entries = [makeEntry({ id: 'e1', athleteId: 'a1', points: 500, worldPosition: 1 })];
      repo.find.mockResolvedValue(entries);
      athletesService.updateRankingCache.mockResolvedValue(undefined);

      await service.recalculate('sport-uuid-1', 2025);

      expect(athletesService.updateRankingCache).toHaveBeenCalledWith(
        'a1',
        expect.objectContaining({ worldRank: expect.any(Number), totalPoints: 500 }),
      );
    });
  });
});
