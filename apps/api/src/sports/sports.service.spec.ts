import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { SportsService } from './sports.service';
import { Sport } from './entities/sport.entity';

const mockRepo = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  count: vi.fn(),
});

const makeSport = (overrides = {}): Sport => ({
  id: 1,
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
    it('should return all active sports ordered by sortOrder', async () => {
      const sports = [makeSport(), makeSport({ id: 2, slug: 'boxing' })];
      repo.find.mockResolvedValue(sports);

      const result = await service.findAll();

      expect(result).toEqual(sports);
      expect(repo.find).toHaveBeenCalledWith({
        where: { isActive: true },
        order: { sortOrder: 'ASC', nameEn: 'ASC' },
      });
    });

    it('should return empty array when no active sports', async () => {
      repo.find.mockResolvedValue([]);
      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  describe('findBySlug', () => {
    it('should return sport by slug', async () => {
      const sport = makeSport();
      repo.findOne.mockResolvedValue(sport);

      const result = await service.findBySlug('armwrestling');

      expect(result).toEqual(sport);
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

      const result = await service.findById(1);

      expect(result).toEqual(sport);
      expect(repo.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw NotFoundException when id not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById(999)).rejects.toThrow(NotFoundException);
      await expect(service.findById(999)).rejects.toThrow('Sport #999 not found');
    });
  });

  describe('create', () => {
    const dto = {
      slug: 'boxing',
      nameRu: 'Бокс',
      nameEn: 'Boxing',
      nameHy: 'Բռնցամարտ',
    };

    it('should create and return new sport', async () => {
      repo.findOne.mockResolvedValue(null); // no duplicate
      const created = makeSport({ slug: 'boxing' });
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.create(dto);

      expect(result).toEqual(created);
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
      repo.findOne.mockResolvedValueOnce(sport); // findById check
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(updated); // findById after update

      const result = await service.update(1, { nameEn: 'Arm Wrestling' });

      expect(repo.update).toHaveBeenCalledWith(1, { nameEn: 'Arm Wrestling' });
      expect(result.nameEn).toBe('Arm Wrestling');
    });

    it('should throw NotFoundException if sport does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update(999, { nameEn: 'X' })).rejects.toThrow(NotFoundException);
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

    it('should skip seeding when sports already exist', async () => {
      repo.count.mockResolvedValue(3);

      await service.seed();

      expect(repo.save).not.toHaveBeenCalled();
    });
  });
});
