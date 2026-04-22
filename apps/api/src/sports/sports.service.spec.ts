import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { resolveSportConfig } from '@gsm/shared-types';
import { SportsService } from './sports.service';
import { Sport } from './entities/sport.entity';

const mockRepo = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  findAndCount: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
});

const makeSport = (overrides = {}): Sport => ({
  id: 'sport-uuid-1',
  slug: 'armwrestling',
  nameRu: 'Армрестлинг',
  nameEn: 'Armwrestling',
  nameHy: 'Ձеռнамарт',
  iconUrl: null,
  descriptionRu: null,
  descriptionEn: null,
  descriptionHy: null,
  isActive: true,
  sortOrder: 1,
  config: {},
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('SportsService', () => {
  let service: SportsService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [SportsService, { provide: getRepositoryToken(Sport), useFactory: mockRepo }],
    }).compile();

    service = module.get(SportsService);
    repo = module.get(getRepositoryToken(Sport));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated active sports ordered by sortOrder', async () => {
      const sports = [makeSport(), makeSport({ id: 'sport-uuid-2', slug: 'boxing' })];
      repo.findAndCount.mockResolvedValue([sports, 2]);

      const result = await service.findAll();

      // Service resolves config through presets/defaults, so compare shape + resolved config.
      expect(result.data).toHaveLength(2);
      expect(result.data[0].slug).toBe('armwrestling');
      expect(result.data[0].config).toEqual(resolveSportConfig('armwrestling', {}));
      expect(result.data[1].config).toEqual(resolveSportConfig('boxing', {}));
      expect(result.meta).toEqual({ total: 2, page: 1, limit: 50, totalPages: 1 });
      expect(repo.findAndCount).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { sortOrder: 'ASC', nameEn: 'ASC' },
        take: 50,
        skip: 0,
      });
    });

    it('should return empty data when no active sports', async () => {
      repo.findAndCount.mockResolvedValue([[], 0]);
      const result = await service.findAll();
      expect(result.data).toEqual([]);
      expect(result.meta.total).toBe(0);
    });
  });

  describe('findBySlug', () => {
    it('should return sport by slug', async () => {
      const sport = makeSport();
      repo.findOne.mockResolvedValue(sport);

      const result = await service.findBySlug('armwrestling');

      expect(result.slug).toBe('armwrestling');
      expect(result.config).toEqual(resolveSportConfig('armwrestling', {}));
      expect(repo.findOne).toHaveBeenCalledWith({ where: { slug: 'armwrestling' } });
    });

    it('should throw NotFoundException when slug not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findBySlug('unknown')).rejects.toThrow(NotFoundException);
      await expect(service.findBySlug('unknown')).rejects.toThrow("Sport 'unknown' not found");
    });
  });

  describe('findById', () => {
    it('should return sport by id', async () => {
      const sport = makeSport();
      repo.findOne.mockResolvedValue(sport);

      const result = await service.findById('sport-uuid-1');

      expect(result.id).toBe('sport-uuid-1');
      expect(result.config).toEqual(resolveSportConfig('armwrestling', {}));
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 'sport-uuid-1' } });
    });

    it('should throw NotFoundException when id not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing-uuid')).rejects.toThrow(NotFoundException);
      await expect(service.findById('missing-uuid')).rejects.toThrow('Sport #missing-uuid not found');
    });
  });

  describe('create', () => {
    const dto = {
      slug: 'boxing',
      nameRu: 'Бокс',
      nameEn: 'Boxing',
      nameHy: 'Բռնцамарт',
    };

    it('should create and return new sport', async () => {
      repo.findOne.mockResolvedValue(null); // no duplicate
      const created = makeSport({ slug: 'boxing' });
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result.slug).toBe('boxing');
      expect(result.config).toEqual(resolveSportConfig('boxing', {}));
      expect(repo.create).toHaveBeenCalledWith(dto);
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if slug already exists', async () => {
      repo.findOne.mockResolvedValue(makeSport({ slug: 'boxing' }));
      await expect(service.create(dto)).rejects.toThrow(ConflictException);
      await expect(service.create(dto)).rejects.toThrow("Sport with slug 'boxing' already exists");
    });
  });

  describe('update', () => {
    it('should update sport and return updated version', async () => {
      const sport = makeSport();
      const updated = makeSport({ nameEn: 'Arm Wrestling' });
      repo.findOne.mockResolvedValueOnce(sport); // findRawById pre-update
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(updated); // findById after update

      const result = await service.update('sport-uuid-1', { nameEn: 'Arm Wrestling' });

      expect(repo.update).toHaveBeenCalledWith('sport-uuid-1', { nameEn: 'Arm Wrestling' });
      expect(result.nameEn).toBe('Arm Wrestling');
    });

    it('should throw NotFoundException if sport does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('missing-uuid', { nameEn: 'X' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('seed', () => {
    it('should seed armwrestling when table is empty', async () => {
      repo.count.mockResolvedValue(0);
      repo.save.mockResolvedValue([]);

      await service.seed();

      expect(repo.save).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ slug: 'armwrestling', nameEn: 'Armwrestling' }),
        ]),
      );
    });

    it('should backfill config but not create new sports when rows exist', async () => {
      // Existing sport with no config — should be backfilled with preset defaults.
      const existing = makeSport({ config: {} });
      repo.count.mockResolvedValue(1);
      repo.find.mockResolvedValue([existing]);

      await service.seed();

      // Didn't create new — only backfilled existing via update.
      expect(repo.save).not.toHaveBeenCalled();
      expect(repo.update).toHaveBeenCalledWith(
        'sport-uuid-1',
        expect.objectContaining({ config: expect.objectContaining({ hasHands: true }) }),
      );
    });

    it('should not touch existing sports whose config already has all preset keys', async () => {
      const complete = makeSport({
        config: {
          categoriesType: 'weight',
          hasHands: true,
          bracketFormats: ['double_elim', 'single_elim'],
          defaultBracketFormat: 'double_elim',
          matchResultSchema: 'armwrestling',
          weighInRequired: true,
          surfaceTerm: { singular: 'стол', plural: 'столы' },
        },
      });
      repo.count.mockResolvedValue(1);
      repo.find.mockResolvedValue([complete]);

      await service.seed();

      expect(repo.update).not.toHaveBeenCalled();
    });
  });
});
