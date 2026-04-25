import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { WeighInsService } from './weigh-ins.service';
import { WeighIn } from './entities/weigh-in.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { EntriesService } from '../entries/entries.service';
import type { TournamentEntry } from '../entries/entities/tournament-entry.entity';

const mockWeighInsRepo = () => ({
  findOne: vi.fn(),
  find: vi.fn(),
  save: vi.fn(),
  create: vi.fn((x: unknown) => x),
  delete: vi.fn(),
});

const mockWeightCategoriesRepo = () => ({
  find: vi.fn(),
});

const mockEntriesService = () => ({
  findById: vi.fn(),
  reassign: vi.fn(),
});

const makeEntry = (overrides: Partial<TournamentEntry> = {}): TournamentEntry =>
  ({
    id: 'entry-1',
    tournamentId: 'tournament-1',
    userId: 'athlete-1',
    status: 'confirmed',
    weightCategoryId: 'wc-70',
    weightCategory: {
      id: 'wc-70',
      tournamentId: 'tournament-1',
      name: '70kg',
      minWeight: null,
      maxWeight: 70,
      gender: 'male',
    },
    tournament: {
      id: 'tournament-1',
      organizerId: 'organizer-1',
      bracketGenerated: false,
      sport: {
        slug: 'armwrestling',
        config: {},
      },
    },
    ...overrides,
  }) as TournamentEntry;

const makeAdmin = () => ({ userId: 'admin-1', roles: ['admin'] });
const makeOrganizer = () => ({ userId: 'organizer-1', roles: ['organizer'] });
const makeStranger = () => ({ userId: 'stranger-1', roles: ['user'] });

describe('WeighInsService', () => {
  let service: WeighInsService;
  let repo: ReturnType<typeof mockWeighInsRepo>;
  let categoriesRepo: ReturnType<typeof mockWeightCategoriesRepo>;
  let entries: ReturnType<typeof mockEntriesService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        WeighInsService,
        { provide: getRepositoryToken(WeighIn), useFactory: mockWeighInsRepo },
        {
          provide: getRepositoryToken(WeightCategory),
          useFactory: mockWeightCategoriesRepo,
        },
        { provide: EntriesService, useFactory: mockEntriesService },
      ],
    }).compile();

    service = module.get(WeighInsService);
    repo = module.get(getRepositoryToken(WeighIn));
    categoriesRepo = module.get(getRepositoryToken(WeightCategory));
    entries = module.get(EntriesService);
  });

  describe('record', () => {
    it('records a weigh-in for a confirmed entry — admin', async () => {
      entries.findById.mockResolvedValue(makeEntry());
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (x: unknown) => ({ id: 'wi-1', ...(x as object) }));

      const result = await service.record('entry-1', 69.5, makeAdmin());

      expect(result.id).toBe('wi-1');
      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          entryId: 'entry-1',
          tournamentId: 'tournament-1',
          officialWeightKg: 69.5,
          verifiedBy: 'admin-1',
        }),
      );
      expect(entries.reassign).not.toHaveBeenCalled();
    });

    it('records a weigh-in — organizer', async () => {
      entries.findById.mockResolvedValue(makeEntry());
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (x: unknown) => ({ id: 'wi-1', ...(x as object) }));

      await expect(service.record('entry-1', 68, makeOrganizer())).resolves.toBeDefined();
    });

    it('overwrites an existing weigh-in (upsert, not duplicate)', async () => {
      entries.findById.mockResolvedValue(makeEntry());
      repo.findOne.mockResolvedValue({
        id: 'wi-existing',
        entryId: 'entry-1',
        tournamentId: 'tournament-1',
        officialWeightKg: 68,
        verifiedBy: 'organizer-1',
      });
      repo.save.mockImplementation(async (x: unknown) => x);

      await service.record('entry-1', 69.8, makeAdmin());

      expect(repo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'wi-existing',
          officialWeightKg: 69.8,
          verifiedBy: 'admin-1',
        }),
      );
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('rejects a non-admin, non-organizer actor', async () => {
      entries.findById.mockResolvedValue(makeEntry());
      await expect(service.record('entry-1', 70, makeStranger())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('rejects weight out of range', async () => {
      entries.findById.mockResolvedValue(makeEntry());
      await expect(service.record('entry-1', 0, makeAdmin())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.record('entry-1', -5, makeAdmin())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      await expect(service.record('entry-1', 600, makeAdmin())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects entries not in confirmed / checked_in status', async () => {
      entries.findById.mockResolvedValue(makeEntry({ status: 'pending' }));
      await expect(service.record('entry-1', 70, makeAdmin())).rejects.toBeInstanceOf(
        BadRequestException,
      );
      entries.findById.mockResolvedValue(makeEntry({ status: 'withdrawn' }));
      await expect(service.record('entry-1', 70, makeAdmin())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('rejects sports whose config does not require a weigh-in', async () => {
      entries.findById.mockResolvedValue(
        makeEntry({
          tournament: {
            id: 'tournament-1',
            organizerId: 'organizer-1',
            bracketGenerated: false,
            sport: { slug: 'chess', config: {} },
          } as TournamentEntry['tournament'],
        }),
      );
      await expect(service.record('entry-1', 70, makeAdmin())).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('auto-reassigns when official weight exceeds current category', async () => {
      entries.findById.mockResolvedValue(makeEntry());
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (x: unknown) => ({ id: 'wi-1', ...(x as object) }));
      categoriesRepo.find.mockResolvedValue([
        { id: 'wc-70', gender: 'male', minWeight: null, maxWeight: 70 },
        { id: 'wc-80', gender: 'male', minWeight: 70, maxWeight: 80 },
        { id: 'wc-90', gender: 'male', minWeight: 80, maxWeight: 90 },
      ]);
      entries.reassign.mockResolvedValue({} as TournamentEntry);

      await service.record('entry-1', 75.4, makeAdmin());

      expect(entries.reassign).toHaveBeenCalledWith(
        'entry-1',
        expect.objectContaining({
          weightCategoryId: 'wc-80',
          weightKg: 75.4,
        }),
        makeAdmin(),
      );
    });

    it('does not reassign when weight still fits current category', async () => {
      entries.findById.mockResolvedValue(makeEntry());
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (x: unknown) => ({ id: 'wi-1', ...(x as object) }));

      await service.record('entry-1', 69.9, makeAdmin());

      expect(categoriesRepo.find).not.toHaveBeenCalled();
      expect(entries.reassign).not.toHaveBeenCalled();
    });

    it('still records weigh-in when no matching category exists (logs, no throw)', async () => {
      entries.findById.mockResolvedValue(makeEntry());
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (x: unknown) => ({ id: 'wi-1', ...(x as object) }));
      // Only the current cat; nothing heavier.
      categoriesRepo.find.mockResolvedValue([
        { id: 'wc-70', gender: 'male', minWeight: null, maxWeight: 70 },
      ]);

      await expect(service.record('entry-1', 85, makeAdmin())).resolves.toBeDefined();
      expect(entries.reassign).not.toHaveBeenCalled();
    });

    it('still records weigh-in when bracket already generated (skips reassign)', async () => {
      entries.findById.mockResolvedValue(
        makeEntry({
          tournament: {
            id: 'tournament-1',
            organizerId: 'organizer-1',
            bracketGenerated: true,
            sport: { slug: 'armwrestling', config: {} },
          } as TournamentEntry['tournament'],
        }),
      );
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (x: unknown) => ({ id: 'wi-1', ...(x as object) }));

      await expect(service.record('entry-1', 85, makeAdmin())).resolves.toBeDefined();
      expect(entries.reassign).not.toHaveBeenCalled();
      expect(categoriesRepo.find).not.toHaveBeenCalled();
    });

    it('skips auto-reassign when entry has no current weightCategory (gender unknown)', async () => {
      // No `weightCategory` ⇒ we have no gender to filter against. Don't
      // guess (e.g. default to "male"); leave it for an admin to handle.
      entries.findById.mockResolvedValue(
        makeEntry({
          weightCategoryId: null,
          weightCategory: null,
        }),
      );
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (x: unknown) => ({ id: 'wi-1', ...(x as object) }));

      await expect(service.record('entry-1', 75, makeAdmin())).resolves.toBeDefined();
      expect(categoriesRepo.find).not.toHaveBeenCalled();
      expect(entries.reassign).not.toHaveBeenCalled();
    });

    it('skips auto-reassign when multiple categories match (cannot disambiguate by ageGroup/hand)', async () => {
      // Two categories share gender + weight band but represent different
      // age groups / hands (encoded in `name` only). Without ageGroup/hand
      // columns on `WeightCategory` we can't pick the right one — surface
      // to the admin instead of silently misrouting the entry.
      entries.findById.mockResolvedValue(makeEntry());
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (x: unknown) => ({ id: 'wi-1', ...(x as object) }));
      categoriesRepo.find.mockResolvedValue([
        { id: 'wc-70', gender: 'male', minWeight: null, maxWeight: 70, name: '70kg' },
        { id: 'wc-80a', gender: 'male', minWeight: 70, maxWeight: 80, name: 'Adults · 80kg · Right' },
        { id: 'wc-80b', gender: 'male', minWeight: 70, maxWeight: 80, name: 'Juniors · 80kg · Right' },
      ]);

      await service.record('entry-1', 75, makeAdmin());

      expect(entries.reassign).not.toHaveBeenCalled();
    });

    it('weigh-in still saves when reassign throws (best-effort)', async () => {
      // reassign() can throw on race conditions (bracket flipped to
      // generated between findById and update, etc.). The weigh-in row
      // is the source of truth and must persist; reassignment failure
      // is logged but doesn't surface as a 500 to the operator.
      entries.findById.mockResolvedValue(makeEntry());
      repo.findOne.mockResolvedValue(null);
      repo.save.mockImplementation(async (x: unknown) => ({ id: 'wi-1', ...(x as object) }));
      categoriesRepo.find.mockResolvedValue([
        { id: 'wc-70', gender: 'male', minWeight: null, maxWeight: 70, name: '70kg' },
        { id: 'wc-80', gender: 'male', minWeight: 70, maxWeight: 80, name: '80kg' },
      ]);
      entries.reassign.mockRejectedValue(new Error('bracket already generated'));

      await expect(service.record('entry-1', 75, makeAdmin())).resolves.toBeDefined();
      expect(repo.save).toHaveBeenCalled();
      expect(entries.reassign).toHaveBeenCalled();
    });
  });

  describe('findByEntryId / findByTournamentId', () => {
    it('returns null when no weigh-in exists for entry', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findByEntryId('entry-1')).resolves.toBeNull();
    });

    it('lists weigh-ins for a tournament', async () => {
      repo.find.mockResolvedValue([{ id: 'wi-1' }, { id: 'wi-2' }]);
      const result = await service.findByTournamentId('tournament-1');
      expect(result).toHaveLength(2);
      expect(repo.find).toHaveBeenCalledWith({
        where: { tournamentId: 'tournament-1' },
        order: { verifiedAt: 'ASC' },
      });
    });
  });

  describe('undo', () => {
    it('admin can undo', async () => {
      repo.findOne.mockResolvedValue({ id: 'wi-1' });
      await service.undo('wi-1', makeAdmin());
      expect(repo.delete).toHaveBeenCalledWith('wi-1');
    });

    it('organizer cannot undo — admin only', async () => {
      await expect(service.undo('wi-1', makeOrganizer())).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });

    it('throws NotFound when weigh-in does not exist', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.undo('wi-missing', makeAdmin())).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
