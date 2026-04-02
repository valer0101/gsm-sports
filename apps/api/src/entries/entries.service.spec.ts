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
    transaction: vi.fn().mockImplementation(async (cb: (em: any) => any) =>
      cb({ getRepository: () => repo }),
    ),
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

describe('EntriesService', () => {
  let service: EntriesService;
  let repo: ReturnType<typeof mockRepo>;
  let tournamentsService: ReturnType<typeof mockTournamentsService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EntriesService,
        { provide: getRepositoryToken(TournamentEntry), useFactory: mockRepo },
        { provide: TournamentsService, useFactory: mockTournamentsService },
      ],
    }).compile();

    service = module.get(EntriesService);
    repo = module.get(getRepositoryToken(TournamentEntry));
    tournamentsService = module.get(TournamentsService);
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

      const result = await service.register({ tournamentId: 'tournament-1' }, 'user-1');
      expect(result.status).toBe('pending');
    });

    it('should throw if registration is closed', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament({ registrationOpen: false }));
      await expect(service.register({ tournamentId: 't1' }, 'u1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if already registered', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament());
      repo.findOne.mockResolvedValue(makeEntry()); // existing entry
      await expect(service.register({ tournamentId: 'tournament-1' }, 'user-1')).rejects.toThrow(
        ConflictException,
      );
    });

    it('should throw if tournament is full', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament({ maxParticipants: 2 }));
      repo.findOne.mockResolvedValue(null);
      repo.count.mockResolvedValue(2); // already full
      await expect(service.register({ tournamentId: 't1' }, 'u2')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if registration deadline passed', async () => {
      const past = new Date(Date.now() - 1000 * 60 * 60);
      tournamentsService.findById.mockResolvedValue(makeTournament({ registrationDeadline: past }));
      await expect(service.register({ tournamentId: 't1' }, 'u1')).rejects.toThrow(
        BadRequestException,
      );
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
});
