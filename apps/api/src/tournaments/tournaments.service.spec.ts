import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { Tournament } from './entities/tournament.entity';
import { WeightCategory } from './entities/weight-category.entity';
import { TournamentOperator } from './entities/tournament-operator.entity';
import { BracketsService } from '../brackets/brackets.service';

// QueryBuilder mock — chainable, returns self for builder methods
const makeQb = (result: [Tournament[], number] = [[], 0]) => {
  const qb: any = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue(result),
  };
  return qb;
};

const mockTournamentsRepo = () => ({
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  createQueryBuilder: vi.fn(),
});

const mockWeightCategoriesRepo = () => ({
  create: vi.fn(),
  save: vi.fn(),
});

const mockOperatorsRepo = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  count: vi.fn(),
  remove: vi.fn(),
});

const mockDataSource = () => ({
  getRepository: vi.fn().mockReturnValue({
    createQueryBuilder: vi.fn().mockReturnValue({
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      skip: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    }),
    findOne: vi.fn(),
    find: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }),
  transaction: vi.fn(),
});

const makeTournament = (overrides = {}): Tournament => ({
  id: 'tournament-uuid-1',
  sportId: 'sport-uuid-1',
  organizerId: 'organizer-uuid-1',
  name: 'Armenia Open 2025',
  nameRu: null,
  nameEn: null,
  nameHy: null,
  slug: 'armenia-open-2025-1234567890',
  descriptionRu: null,
  descriptionEn: null,
  descriptionHy: null,
  startDate: new Date('2025-06-01'),
  endDate: null,
  location: 'Yerevan',
  country: 'Armenia',
  city: 'Yerevan',
  format: 'double_elimination',
  maxParticipants: null,
  registrationOpen: false,
  bracketGenerated: false,
  registrationDeadline: null,
  status: 'draft',
  isFeatured: false,
  isLive: false,
  posterUrl: null,
  streamUrl: null,
  sportConfig: {},
  weightCategories: [],
  sport: null as any,
  organizer: null as any,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const makeCreateDto = (overrides = {}) => ({
  sportId: 'sport-uuid-1',
  name: 'Armenia Open 2025',
  startDate: '2025-06-01T10:00:00Z',
  ...overrides,
});

describe('TournamentsService', () => {
  let service: TournamentsService;
  let tournamentsRepo: ReturnType<typeof mockTournamentsRepo>;
  let weightCategoriesRepo: ReturnType<typeof mockWeightCategoriesRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TournamentsService,
        { provide: getRepositoryToken(Tournament), useFactory: mockTournamentsRepo },
        { provide: getRepositoryToken(WeightCategory), useFactory: mockWeightCategoriesRepo },
        { provide: getRepositoryToken(TournamentOperator), useFactory: mockOperatorsRepo },
        { provide: DataSource, useFactory: mockDataSource },
        { provide: BracketsService, useValue: { generateWithWeightBuckets: vi.fn() } },
      ],
    }).compile();

    service = module.get(TournamentsService);
    tournamentsRepo = module.get(getRepositoryToken(Tournament));
    weightCategoriesRepo = module.get(getRepositoryToken(WeightCategory));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated tournaments with default options', async () => {
      const tournaments = [makeTournament()];
      const qb = makeQb([tournaments, 1]);
      tournamentsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll();

      expect(result.data).toEqual(tournaments);
      expect(result.meta).toEqual({ total: 1, page: 1, limit: 20, totalPages: 1 });
      expect(qb.take).toHaveBeenCalledWith(20);
      expect(qb.skip).toHaveBeenCalledWith(0);
    });

    it('should apply sport filter when provided', async () => {
      const qb = makeQb([[], 0]);
      tournamentsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ sport: 'armwrestling' });

      expect(qb.andWhere).toHaveBeenCalledWith('sport.slug = :sport', { sport: 'armwrestling' });
    });

    it('should apply status filter when provided', async () => {
      const qb = makeQb([[], 0]);
      tournamentsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ status: 'active' });

      expect(qb.andWhere).toHaveBeenCalledWith('t.status = :status', { status: 'active' });
    });

    it('should apply country filter when provided', async () => {
      const qb = makeQb([[], 0]);
      tournamentsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ country: 'Armenia' });

      expect(qb.andWhere).toHaveBeenCalledWith('t.country = :country', { country: 'Armenia' });
    });

    it('should cap limit at 100', async () => {
      const qb = makeQb([[], 0]);
      tournamentsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ limit: 999 });

      expect(qb.take).toHaveBeenCalledWith(100);
    });

    it('should calculate skip correctly for page 3', async () => {
      const qb = makeQb([[], 0]);
      tournamentsRepo.createQueryBuilder.mockReturnValue(qb);

      await service.findAll({ page: 3, limit: 10 });

      expect(qb.skip).toHaveBeenCalledWith(20);
    });

    it('should calculate totalPages correctly', async () => {
      const qb = makeQb([new Array(10).fill(makeTournament()), 25]);
      tournamentsRepo.createQueryBuilder.mockReturnValue(qb);

      const result = await service.findAll({ limit: 10 });

      expect(result.meta.totalPages).toBe(3);
    });
  });

  describe('findBySlug', () => {
    it('should return tournament by slug', async () => {
      const tournament = makeTournament();
      tournamentsRepo.findOne.mockResolvedValue(tournament);

      const result = await service.findBySlug('armenia-open-2025-1234567890');

      expect(result).toEqual(tournament);
      expect(tournamentsRepo.findOne).toHaveBeenCalledWith({
        where: { slug: 'armenia-open-2025-1234567890' },
        relations: ['sport', 'organizer', 'weightCategories'],
      });
    });

    it('should throw NotFoundException when slug not found', async () => {
      tournamentsRepo.findOne.mockResolvedValue(null);
      await expect(service.findBySlug('missing')).rejects.toThrow(NotFoundException);
      await expect(service.findBySlug('missing')).rejects.toThrow("Tournament 'missing' not found");
    });
  });

  describe('findById', () => {
    it('should return tournament by id', async () => {
      const tournament = makeTournament();
      tournamentsRepo.findOne.mockResolvedValue(tournament);

      const result = await service.findById('tournament-uuid-1');

      expect(result).toEqual(tournament);
    });

    it('should throw NotFoundException when id not found', async () => {
      tournamentsRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing-id')).rejects.toThrow(NotFoundException);
      await expect(service.findById('missing-id')).rejects.toThrow(
        'Tournament #missing-id not found',
      );
    });
  });

  describe('create', () => {
    it('should create tournament with status draft and auto-generated slug', async () => {
      const dto = makeCreateDto();
      const created = makeTournament();
      tournamentsRepo.create.mockReturnValue(created);
      tournamentsRepo.save.mockResolvedValue(created);
      tournamentsRepo.findOne.mockResolvedValue(created); // findById call

      const result = await service.create(dto as any, 'organizer-uuid-1');

      expect(tournamentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'draft', organizerId: 'organizer-uuid-1' }),
      );
      expect(result.status).toBe('draft');
    });

    it('should save weight categories when provided', async () => {
      const dto = makeCreateDto({
        weightCategories: [
          { name: 'до 70 кг', maxWeight: 70, gender: 'male' },
          { name: 'до 80 кг', maxWeight: 80, gender: 'male' },
        ],
      });
      const created = makeTournament({ id: 'saved-id' });
      tournamentsRepo.create.mockReturnValue(created);
      tournamentsRepo.save.mockResolvedValue(created);
      tournamentsRepo.findOne.mockResolvedValue(created);
      weightCategoriesRepo.create.mockImplementation((wc) => wc);
      weightCategoriesRepo.save.mockResolvedValue([]);

      await service.create(dto as any, 'organizer-uuid-1');

      expect(weightCategoriesRepo.create).toHaveBeenCalledTimes(2);
      expect(weightCategoriesRepo.save).toHaveBeenCalledOnce();
    });

    it('should skip weight categories when not provided', async () => {
      const dto = makeCreateDto();
      const created = makeTournament();
      tournamentsRepo.create.mockReturnValue(created);
      tournamentsRepo.save.mockResolvedValue(created);
      tournamentsRepo.findOne.mockResolvedValue(created);

      await service.create(dto as any, 'organizer-uuid-1');

      expect(weightCategoriesRepo.save).not.toHaveBeenCalled();
    });

    it('should convert startDate string to Date object', async () => {
      const dto = makeCreateDto({ startDate: '2025-06-01T10:00:00Z' });
      const created = makeTournament();
      tournamentsRepo.create.mockReturnValue(created);
      tournamentsRepo.save.mockResolvedValue(created);
      tournamentsRepo.findOne.mockResolvedValue(created);

      await service.create(dto as any, 'organizer-uuid-1');

      expect(tournamentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ startDate: new Date('2025-06-01T10:00:00Z') }),
      );
    });

    it('should set endDate to null when not provided', async () => {
      const dto = makeCreateDto();
      const created = makeTournament();
      tournamentsRepo.create.mockReturnValue(created);
      tournamentsRepo.save.mockResolvedValue(created);
      tournamentsRepo.findOne.mockResolvedValue(created);

      await service.create(dto as any, 'organizer-uuid-1');

      expect(tournamentsRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ endDate: null }),
      );
    });
  });

  describe('update', () => {
    it('should update tournament when user is organizer', async () => {
      const tournament = makeTournament();
      const updated = makeTournament({ name: 'Updated Name' });
      tournamentsRepo.findOne.mockResolvedValueOnce(tournament).mockResolvedValueOnce(updated);
      tournamentsRepo.update.mockResolvedValue(undefined);

      const result = await service.update(
        'tournament-uuid-1',
        { name: 'Updated Name' },
        'organizer-uuid-1',
      );

      expect(tournamentsRepo.update).toHaveBeenCalled();
      expect(result.name).toBe('Updated Name');
    });

    it('should throw ForbiddenException when user is not organizer', async () => {
      tournamentsRepo.findOne.mockResolvedValue(
        makeTournament({ organizerId: 'organizer-uuid-1' }),
      );

      await expect(
        service.update('tournament-uuid-1', { name: 'X' }, 'different-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should convert startDate string to Date when updating', async () => {
      const tournament = makeTournament();
      tournamentsRepo.findOne.mockResolvedValueOnce(tournament).mockResolvedValueOnce(tournament);
      tournamentsRepo.update.mockResolvedValue(undefined);

      await service.update(
        'tournament-uuid-1',
        { startDate: '2025-09-01T10:00:00Z' },
        'organizer-uuid-1',
      );

      expect(tournamentsRepo.update).toHaveBeenCalledWith(
        'tournament-uuid-1',
        expect.objectContaining({ startDate: new Date('2025-09-01T10:00:00Z') }),
      );
    });

    it('should throw NotFoundException when tournament not found', async () => {
      tournamentsRepo.findOne.mockResolvedValue(null);
      await expect(service.update('missing', {}, 'user')).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateStatus', () => {
    it('should update status regardless of user', async () => {
      const tournament = makeTournament();
      tournamentsRepo.findOne
        .mockResolvedValueOnce(tournament)
        .mockResolvedValueOnce(makeTournament({ status: 'active' }));
      tournamentsRepo.update.mockResolvedValue(undefined);

      const result = await service.updateStatus('tournament-uuid-1', 'active', 'organizer-uuid-1');

      expect(tournamentsRepo.update).toHaveBeenCalledWith('tournament-uuid-1', {
        status: 'active',
      });
      expect(result.status).toBe('active');
    });

    it('should throw NotFoundException when tournament not found', async () => {
      tournamentsRepo.findOne.mockResolvedValue(null);
      await expect(service.updateStatus('missing', 'active', 'some-user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleRegistration', () => {
    it('should open registration when currently closed', async () => {
      const tournament = makeTournament({ registrationOpen: false, bracketGenerated: false });
      tournamentsRepo.findOne
        .mockResolvedValueOnce(tournament)
        .mockResolvedValueOnce(
          makeTournament({ registrationOpen: true, status: 'registration_open' }),
        );
      tournamentsRepo.update.mockResolvedValue(undefined);

      const result = await service.toggleRegistration('tournament-uuid-1', 'organizer-uuid-1');

      expect(tournamentsRepo.update).toHaveBeenCalledWith('tournament-uuid-1', {
        registrationOpen: true,
        status: 'registration_open',
      });
      expect(result.registrationOpen).toBe(true);
    });

    it('should close registration when currently open', async () => {
      const tournament = makeTournament({ registrationOpen: true, bracketGenerated: false });
      tournamentsRepo.findOne
        .mockResolvedValueOnce(tournament)
        .mockResolvedValueOnce(
          makeTournament({ registrationOpen: false, status: 'registration_closed' }),
        );
      tournamentsRepo.update.mockResolvedValue(undefined);

      const result = await service.toggleRegistration('tournament-uuid-1', 'organizer-uuid-1');

      expect(tournamentsRepo.update).toHaveBeenCalledWith('tournament-uuid-1', {
        registrationOpen: false,
        status: 'registration_closed',
      });
      expect(result.registrationOpen).toBe(false);
    });

    it('should throw ForbiddenException when user is not organizer', async () => {
      tournamentsRepo.findOne.mockResolvedValue(
        makeTournament({ organizerId: 'organizer-uuid-1' }),
      );

      await expect(
        service.toggleRegistration('tournament-uuid-1', 'different-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException when tournament not found', async () => {
      tournamentsRepo.findOne.mockResolvedValue(null);
      await expect(service.toggleRegistration('missing', 'user')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
