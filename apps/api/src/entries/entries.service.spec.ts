import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { EntriesService } from './entries.service';
import { TournamentEntry } from './entities/tournament-entry.entity';
import { User } from '../users/entities/user.entity';
import { TournamentsService } from '../tournaments/tournaments.service';

const mockRepo = () => {
  const repo: any = {
    findOne: vi.fn(),
    find: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
    createQueryBuilder: vi.fn(),
  };
  repo.manager = {
    transaction: vi
      .fn()
      .mockImplementation(async (cb: (em: any) => any) => cb({ getRepository: () => repo })),
  };
  return repo;
};

const mockTournamentsService = () => ({
  findById: vi.fn(),
});

const makeTournament = (overrides = {}) => ({
  id: 'tournament-1',
  organizerId: 'org-1',
  registrationOpen: true,
  registrationDeadline: null,
  maxParticipants: null,
  ...overrides,
});

const makeEntry = (overrides = {}) => ({
  id: 'entry-1',
  tournamentId: 'tournament-1',
  userId: 'user-1',
  status: 'pending',
  tournament: makeTournament(),
  weightCategory: null,
  user: { firstName: 'John', lastName: 'Doe' },
  ...overrides,
});

const mockUsersRepo = () => ({
  findOne: vi.fn().mockResolvedValue({ id: 'user-1', country: null }),
});

describe('EntriesService', () => {
  let service: EntriesService;
  let repo: ReturnType<typeof mockRepo>;
  let usersRepo: ReturnType<typeof mockUsersRepo>;
  let tournamentsService: ReturnType<typeof mockTournamentsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EntriesService,
        { provide: getRepositoryToken(TournamentEntry), useFactory: mockRepo },
        { provide: getRepositoryToken(User), useFactory: mockUsersRepo },
        { provide: TournamentsService, useFactory: mockTournamentsService },
      ],
    }).compile();

    service = module.get(EntriesService);
    repo = module.get(getRepositoryToken(TournamentEntry));
    usersRepo = module.get(getRepositoryToken(User));
    tournamentsService = module.get(TournamentsService);
    void usersRepo; // referenced by tests via `service` only
  });

  describe('register', () => {
    it('should register successfully', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament());
      repo.findOne.mockResolvedValueOnce(null); // no existing entry
      repo.count.mockResolvedValue(0);
      repo.create.mockReturnValue(makeEntry());
      repo.save.mockResolvedValue(makeEntry());
      // findById call after save
      repo.findOne.mockResolvedValueOnce(makeEntry());

      const result = await service.register(
        { tournamentId: 'tournament-1', ageGroup: 'adults', hand: 'right', weightKg: 75 },
        'user-1',
      );
      expect(result.status).toBe('pending');
    });

    it('should throw if registration is closed', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament({ registrationOpen: false }));
      await expect(
        service.register(
          { tournamentId: 't1', ageGroup: 'adults', hand: 'right', weightKg: 75 },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if already registered', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament());
      repo.findOne.mockResolvedValue(makeEntry()); // existing entry
      await expect(
        service.register(
          { tournamentId: 'tournament-1', ageGroup: 'adults', hand: 'right', weightKg: 75 },
          'user-1',
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw if tournament is full', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament({ maxParticipants: 2 }));
      repo.findOne.mockResolvedValue(null);
      const qb = {
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getCount: vi.fn().mockResolvedValue(2),
      };
      repo.createQueryBuilder.mockReturnValue(qb);
      await expect(
        service.register(
          { tournamentId: 't1', ageGroup: 'adults', hand: 'right', weightKg: 75 },
          'u2',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw if registration deadline passed', async () => {
      const past = new Date(Date.now() - 1000 * 60 * 60);
      tournamentsService.findById.mockResolvedValue(makeTournament({ registrationDeadline: past }));
      await expect(
        service.register(
          { tournamentId: 't1', ageGroup: 'adults', hand: 'right', weightKg: 75 },
          'u1',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findById', () => {
    it('should return entry', async () => {
      repo.findOne.mockResolvedValue(makeEntry());
      const result = await service.findById('entry-1');
      expect(result.id).toBe('entry-1');
    });

    it('should throw NotFoundException if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('withdraw', () => {
    it('should set status to withdrawn', async () => {
      repo.findOne.mockResolvedValueOnce(makeEntry({ status: 'confirmed' }));
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(makeEntry({ status: 'withdrawn' }));

      const result = await service.withdraw('entry-1', 'user-1');
      expect(repo.update).toHaveBeenCalledWith('entry-1', { status: 'withdrawn' });
      expect(result.status).toBe('withdrawn');
    });

    it('should throw ForbiddenException if not the owner', async () => {
      repo.findOne.mockResolvedValue(makeEntry({ userId: 'other-user' }));
      await expect(service.withdraw('entry-1', 'user-1')).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException if already withdrawn', async () => {
      repo.findOne.mockResolvedValue(makeEntry({ status: 'withdrawn' }));
      await expect(service.withdraw('entry-1', 'user-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should update status when organizer', async () => {
      repo.findOne.mockResolvedValueOnce(makeEntry());
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(makeEntry({ status: 'confirmed' }));

      const result = await service.updateStatus('entry-1', 'confirmed', 'org-1');
      expect(repo.update).toHaveBeenCalledWith('entry-1', { status: 'confirmed' });
    });

    it('should throw ForbiddenException if not organizer', async () => {
      repo.findOne.mockResolvedValue(makeEntry());
      await expect(service.updateStatus('entry-1', 'confirmed', 'wrong-org')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('reassign', () => {
    const actor = { userId: 'org-1', roles: [] as string[] };

    it('allows organizer to reassign before bracket is generated', async () => {
      repo.findOne.mockResolvedValueOnce(
        makeEntry({ tournament: makeTournament({ bracketGenerated: false }), notes: null }),
      );
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(
        makeEntry({ weightKg: 75, notes: '[reassign by org-1 ...] wrong weight' }),
      );

      const result = await service.reassign(
        'entry-1',
        { weightKg: 75, reason: 'wrong weight' },
        actor,
      );

      expect(repo.update).toHaveBeenCalled();
      const updateArg = repo.update.mock.calls[0][1];
      expect(updateArg.weightKg).toBe(75);
      expect(updateArg.notes).toMatch(/wrong weight/);
      expect(result.weightKg).toBe(75);
    });

    it('allows admin to reassign even if not the organizer', async () => {
      repo.findOne.mockResolvedValueOnce(
        makeEntry({ tournament: makeTournament({ bracketGenerated: false }) }),
      );
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(makeEntry());

      await service.reassign(
        'entry-1',
        { ageGroup: 'veterans', reason: 'age correction' },
        { userId: 'someone-else', roles: ['admin'] },
      );

      expect(repo.update).toHaveBeenCalled();
    });

    it('rejects non-admin non-organizer with Forbidden', async () => {
      repo.findOne.mockResolvedValue(
        makeEntry({ tournament: makeTournament({ bracketGenerated: false }) }),
      );

      await expect(
        service.reassign(
          'entry-1',
          { hand: 'left', reason: 'fixing hand' },
          { userId: 'random', roles: [] },
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects reassign after the bracket is generated', async () => {
      repo.findOne.mockResolvedValue(
        makeEntry({ tournament: makeTournament({ bracketGenerated: true }) }),
      );

      await expect(
        service.reassign('entry-1', { weightKg: 80, reason: 'too late' }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects an empty patch (reason alone is not enough)', async () => {
      repo.findOne.mockResolvedValue(
        makeEntry({ tournament: makeTournament({ bracketGenerated: false }) }),
      );

      await expect(
        service.reassign('entry-1', { reason: 'no fields' }, actor),
      ).rejects.toThrow(BadRequestException);
    });

    it('appends the reason to entry.notes (preserving existing notes)', async () => {
      repo.findOne.mockResolvedValueOnce(
        makeEntry({
          tournament: makeTournament({ bracketGenerated: false }),
          notes: 'existing note',
        }),
      );
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(makeEntry());

      await service.reassign('entry-1', { weightKg: 85, reason: 'weigh-in correction' }, actor);

      const updateArg = repo.update.mock.calls[0][1];
      expect(updateArg.notes).toMatch(/^existing note\n\[reassign by org-1 @ .+\] weigh-in correction$/);
    });
  });
});
