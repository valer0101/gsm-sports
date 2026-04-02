import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AthletesService } from './athletes.service';
import { Athlete } from './entities/athlete.entity';

const makeQb = (result: [Athlete[], number] = [[], 0]) => ({
  leftJoinAndSelect: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  andWhere: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  addOrderBy: vi.fn().mockReturnThis(),
  take: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  getManyAndCount: vi.fn().mockResolvedValue(result),
});

const mockRepo = () => ({
  findOne: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  createQueryBuilder: vi.fn(),
});

const makeAthlete = (overrides = {}): Athlete => ({
  id: 'athlete-uuid-1',
  userId: 'user-uuid-1',
  sportId: 'sport-uuid-1',
  firstName: 'Armen',
  lastName: 'Harutyunyan',
  slug: 'armen-harutyunyan-1234567890',
  country: 'Armenia',
  city: 'Yerevan',
  dateOfBirth: new Date('1995-03-15'),
  gender: 'male',
  primaryHand: 'right',
  weight: 70,
  height: 175,
  experienceLevel: 'professional',
  bioRu: null,
  bioEn: null,
  bioHy: null,
  photoUrl: null,
  socialLinks: {},
  achievements: {},
  worldRank: 1,
  countryRank: 1,
  totalPoints: 500,
  isVerified: false,
  isActive: true,
  sport: null as any,
  user: null as any,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('AthletesService', () => {
  let service: AthletesService;
  let repo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [AthletesService, { provide: getRepositoryToken(Athlete), useFactory: mockRepo }],
    }).compile();

    service = module.get(AthletesService);
    repo = module.get(getRepositoryToken(Athlete));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated athletes with default options', async () => {
      const athletes = [makeAthlete()];
      const qb = makeQb([athletes, 1]);
      repo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll();

      expect(result.data).toEqual(athletes);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
    });

    it('should apply sport filter', async () => {
      const qb = makeQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ sport: 'armwrestling' });
      expect(qb.andWhere).toHaveBeenCalledWith('sport.slug = :sport', { sport: 'armwrestling' });
    });

    it('should apply country filter', async () => {
      const qb = makeQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ country: 'Armenia' });
      expect(qb.andWhere).toHaveBeenCalledWith('a.country = :country', { country: 'Armenia' });
    });

    it('should apply search filter with ILIKE', async () => {
      const qb = makeQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ search: 'Armen' });
      expect(qb.andWhere).toHaveBeenCalledWith(expect.stringContaining('ILIKE'), {
        search: '%Armen%',
      });
    });

    it('should cap limit at 100', async () => {
      const qb = makeQb();
      repo.createQueryBuilder.mockReturnValue(qb);
      await service.findAll({ limit: 500 });
      expect(qb.take).toHaveBeenCalledWith(100);
    });
  });

  describe('findBySlug', () => {
    it('should return athlete by slug', async () => {
      const athlete = makeAthlete();
      repo.findOne.mockResolvedValue(athlete);
      const result = await service.findBySlug('armen-harutyunyan-1234567890');
      expect(result).toEqual(athlete);
    });

    it('should throw NotFoundException when slug not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findBySlug('missing')).rejects.toThrow(NotFoundException);
      await expect(service.findBySlug('missing')).rejects.toThrow("Athlete 'missing' not found");
    });
  });

  describe('findById', () => {
    it('should return athlete by id', async () => {
      const athlete = makeAthlete();
      repo.findOne.mockResolvedValue(athlete);
      const result = await service.findById('athlete-uuid-1');
      expect(result).toEqual(athlete);
    });

    it('should throw NotFoundException when not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      sportId: 'sport-uuid-1',
      firstName: 'Armen',
      lastName: 'Harutyunyan',
      country: 'Armenia',
    };

    it('should create athlete and return it', async () => {
      // dto has no userId → no duplicate check → only findById call
      const athlete = makeAthlete();
      repo.create.mockReturnValue(athlete);
      repo.save.mockResolvedValue(athlete);
      repo.findOne.mockResolvedValue(athlete); // findById after save

      const result = await service.create(dto as any, 'creator-uuid');
      expect(result).toEqual(athlete);
      expect(repo.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if userId+sportId already exists', async () => {
      const dtoWithUser = { ...dto, userId: 'user-uuid-1' };
      repo.findOne.mockResolvedValue(makeAthlete()); // existing profile found

      await expect(service.create(dtoWithUser as any, 'creator')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should not check for duplicates when userId is not provided', async () => {
      const athlete = makeAthlete({ userId: null });
      repo.create.mockReturnValue(athlete);
      repo.save.mockResolvedValue(athlete);
      repo.findOne.mockResolvedValue(athlete);

      await service.create(dto as any, 'creator');
      // findOne called once (findById only), no duplicate check since userId absent
      expect(repo.findOne).toHaveBeenCalledTimes(1);
    });
  });

  describe('update', () => {
    it('should update athlete when owner', async () => {
      const athlete = makeAthlete();
      const updated = makeAthlete({ country: 'Russia' });
      repo.findOne.mockResolvedValueOnce(athlete).mockResolvedValueOnce(updated);
      repo.update.mockResolvedValue(undefined);

      const result = await service.update('athlete-uuid-1', { country: 'Russia' }, 'user-uuid-1');
      expect(result.country).toBe('Russia');
    });

    it('should throw ForbiddenException when not owner', async () => {
      repo.findOne.mockResolvedValue(makeAthlete({ userId: 'user-uuid-1' }));
      await expect(service.update('a1', { country: 'X' }, 'other-user')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw NotFoundException when athlete not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', {}, 'user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('verify', () => {
    it('should set isVerified to true', async () => {
      const athlete = makeAthlete({ isVerified: false });
      const verified = makeAthlete({ isVerified: true });
      repo.findOne.mockResolvedValueOnce(athlete).mockResolvedValueOnce(verified);
      repo.update.mockResolvedValue(undefined);

      const result = await service.verify('athlete-uuid-1');
      expect(repo.update).toHaveBeenCalledWith('athlete-uuid-1', { isVerified: true });
      expect(result.isVerified).toBe(true);
    });

    it('should throw NotFoundException if athlete not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.verify('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateRankingCache', () => {
    it('should update worldRank and totalPoints', async () => {
      repo.update.mockResolvedValue(undefined);
      await service.updateRankingCache('athlete-uuid-1', { worldRank: 3, totalPoints: 400 });
      expect(repo.update).toHaveBeenCalledWith('athlete-uuid-1', {
        worldRank: 3,
        totalPoints: 400,
      });
    });
  });
});
