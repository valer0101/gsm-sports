import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BracketsService } from './brackets.service';
import { Bracket } from './entities/bracket.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { TournamentsService } from '../tournaments/tournaments.service';
import { EntriesService } from '../entries/entries.service';
import { EventsGateway } from '../events/events.gateway';

vi.mock('@gsm/bracket-engine', () => ({
  generateDoubleElimination: vi.fn(() => ({
    players: [],
    bracketSize: 4,
    wbRounds: 2,
    winnersBracket: [],
    losersBracket: [],
    grandFinal: {},
    superFinal: {},
    champion: null,
    status: 'active',
  })),
  selectWinner: vi.fn((data: any, matchId: string, winnerId: string) => ({
    ...data,
    status: 'active',
  })),
}));

const mockRepo = () => ({
  findOne: vi.fn(),
  find: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
});

const mockTournamentsService = () => ({
  findById: vi.fn(),
});

const mockEntriesService = () => ({
  findByTournament: vi.fn(),
});

const makeTournament = (overrides = {}) => ({
  id: 'tournament-1',
  organizerId: 'org-1',
  ...overrides,
});

const makeBracket = (overrides = {}) => ({
  id: 'bracket-1',
  tournamentId: 'tournament-1',
  weightCategoryId: null,
  status: 'active',
  bracketData: { status: 'active', players: [] },
  tournament: makeTournament(),
  weightCategory: null,
  ...overrides,
});

const makeEntry = (userId: string) => ({
  id: `entry-${userId}`,
  userId,
  user: { firstName: 'Player', lastName: userId },
  seedNumber: null,
});

describe('BracketsService', () => {
  let service: BracketsService;
  let repo: ReturnType<typeof mockRepo>;
  let tournamentsService: ReturnType<typeof mockTournamentsService>;
  let entriesService: ReturnType<typeof mockEntriesService>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        BracketsService,
        { provide: getRepositoryToken(Bracket), useFactory: mockRepo },
        {
          provide: getRepositoryToken(TournamentOperator),
          useFactory: () => ({ count: vi.fn().mockResolvedValue(0) }),
        },
        { provide: TournamentsService, useFactory: mockTournamentsService },
        { provide: EntriesService, useFactory: mockEntriesService },
        { provide: EventsGateway, useValue: { emitBracketUpdate: vi.fn() } },
      ],
    }).compile();

    service = module.get(BracketsService);
    repo = module.get(getRepositoryToken(Bracket));
    tournamentsService = module.get(TournamentsService);
    entriesService = module.get(EntriesService);
  });

  describe('generate', () => {
    it('should generate bracket with confirmed entries', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament());
      entriesService.findByTournament.mockResolvedValue({
        data: [makeEntry('u1'), makeEntry('u2'), makeEntry('u3'), makeEntry('u4')],
      });
      const created = makeBracket();
      repo.create.mockReturnValue(created);
      repo.save.mockResolvedValue(created);

      const result = await service.generate({ tournamentId: 'tournament-1' }, 'org-1');
      expect(result.status).toBe('active');
    });

    it('should throw if not organizer', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament());
      await expect(service.generate({ tournamentId: 't1' }, 'wrong')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if fewer than 2 entries', async () => {
      tournamentsService.findById.mockResolvedValue(makeTournament());
      entriesService.findByTournament.mockResolvedValue({ data: [makeEntry('u1')] });
      await expect(service.generate({ tournamentId: 't1' }, 'org-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('findById', () => {
    it('should return bracket', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      const result = await service.findById('bracket-1');
      expect(result.id).toBe('bracket-1');
    });

    it('should throw if not found', async () => {
      repo.findOne.mockResolvedValue(null);
      await expect(service.findById('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('recordResult', () => {
    it('should update bracket with winner', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(makeBracket());

      const result = await service.recordResult('bracket-1', 'match-1', 'u1', 'org-1', []);
      expect(repo.update).toHaveBeenCalled();
    });

    it('should throw if not organizer', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(service.recordResult('b1', 'm1', 'u1', 'wrong', [])).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw if bracket is completed', async () => {
      repo.findOne.mockResolvedValue(makeBracket({ status: 'completed' }));
      await expect(service.recordResult('b1', 'm1', 'u1', 'org-1', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should set status to completed when engine returns completed', async () => {
      const { selectWinner } = await import('@gsm/bracket-engine');
      vi.mocked(selectWinner).mockReturnValueOnce({ status: 'completed', champion: 'u1' } as any);

      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(makeBracket({ status: 'completed' }));

      const result = await service.recordResult('bracket-1', 'm1', 'u1', 'org-1');
      expect(repo.update).toHaveBeenCalledWith(
        'bracket-1',
        expect.objectContaining({ status: 'completed' }),
      );
    });
  });

  describe('reset', () => {
    it('should reset bracket to pending', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.update.mockResolvedValue(undefined);
      repo.findOne.mockResolvedValueOnce(makeBracket({ status: 'pending', bracketData: null }));

      await service.reset('bracket-1', 'org-1');
      expect(repo.update).toHaveBeenCalledWith('bracket-1', {
        bracketData: null,
        status: 'pending',
      });
    });

    it('should throw if not organizer', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(service.reset('b1', 'wrong')).rejects.toThrow(ForbiddenException);
    });
  });
});
