import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { BracketsService } from './brackets.service';
import { Bracket } from './entities/bracket.entity';
import { BracketAuditLog } from './entities/bracket-audit-log.entity';
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
    grandFinal: { id: 'grand_final' },
    superFinal: { id: 'super_final', needed: false },
    champion: null,
    status: 'active',
  })),
  selectWinner: vi.fn((data: any) => ({ ...data, status: 'active' })),
  resetMatch: vi.fn((data: any) => ({ ...data, status: 'active' })),
  validateResult: vi.fn(() => ({ valid: true, errors: [] })),
  canRecordResult: vi.fn(() => ({ valid: true, errors: [] })),
  findMatch: vi.fn((_data: any, matchId: string) => ({
    id: matchId,
    player1: { id: 'p1', firstName: 'A', lastName: 'B', number: 1 },
    player2: { id: 'p2', firstName: 'C', lastName: 'D', number: 2 },
    winner: null,
    loser: null,
  })),
}));

// Builder that mimics TypeORM's createQueryBuilder().update().set().where().execute()
function makeUpdateQB(affected: number = 1) {
  const qb: any = {
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ affected }),
  };
  return qb;
}

const mockRepo = () => ({
  findOne: vi.fn(),
  find: vi.fn(),
  create: vi.fn((x) => x),
  save: vi.fn((x) => Promise.resolve(x)),
  update: vi.fn(),
  createQueryBuilder: vi.fn(() => makeUpdateQB(1)),
});

const mockOperatorsRepo = () => ({ count: vi.fn().mockResolvedValue(0) });
const mockAuditRepo = () => ({ create: vi.fn((x) => x), save: vi.fn(), find: vi.fn() });

const mockTournamentsService = () => ({ findById: vi.fn() });
const mockEntriesService = () => ({ findByTournament: vi.fn(), findByGroup: vi.fn() });

const makeTournament = (overrides = {}) => ({
  id: 'tournament-1',
  organizerId: 'org-1',
  ...overrides,
});

const makeBracket = (overrides: any = {}) => ({
  id: 'bracket-1',
  tournamentId: 'tournament-1',
  weightCategoryId: null,
  status: 'active' as const,
  bracketData: { status: 'active', players: [], winnersBracket: [], losersBracket: [] },
  tournament: makeTournament(),
  weightCategory: null,
  isLocked: false,
  lastModifiedBy: null,
  lastModifiedAt: null,
  modificationCount: 0,
  completedAt: null,
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
  let auditRepo: ReturnType<typeof mockAuditRepo>;
  let operatorsRepo: ReturnType<typeof mockOperatorsRepo>;
  let tournamentsService: ReturnType<typeof mockTournamentsService>;
  let entriesService: ReturnType<typeof mockEntriesService>;
  let eventsGateway: { emitBracketUpdate: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    // Pre-create repo mocks so we can share them between the module and the transaction EM
    const bracketRepo = mockRepo();
    const auditRepoInstance = mockAuditRepo();

    // Fake EntityManager that returns the same repos when getRepository(entity) is called
    const fakeEm = {
      getRepository: vi.fn((entity: any) => {
        if (entity === Bracket) return bracketRepo;
        if (entity === BracketAuditLog) return auditRepoInstance;
        return { save: vi.fn(), create: vi.fn(), update: vi.fn() };
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        BracketsService,
        { provide: getRepositoryToken(Bracket), useValue: bracketRepo },
        { provide: getRepositoryToken(BracketAuditLog), useValue: auditRepoInstance },
        { provide: getRepositoryToken(TournamentOperator), useFactory: mockOperatorsRepo },
        { provide: TournamentsService, useFactory: mockTournamentsService },
        { provide: EntriesService, useFactory: mockEntriesService },
        { provide: EventsGateway, useValue: { emitBracketUpdate: vi.fn() } },
        {
          provide: getDataSourceToken(),
          useValue: {
            getRepository: vi.fn(),
            transaction: vi.fn(async (cb: any) => cb(fakeEm)),
          },
        },
      ],
    }).compile();

    service = module.get(BracketsService);
    repo = module.get(getRepositoryToken(Bracket));
    auditRepo = module.get(getRepositoryToken(BracketAuditLog));
    operatorsRepo = module.get(getRepositoryToken(TournamentOperator));
    tournamentsService = module.get(TournamentsService);
    entriesService = module.get(EntriesService);
    eventsGateway = module.get(EventsGateway);
  });

  afterEach(() => {
    vi.clearAllMocks();
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
    it('should call selectWinner and update bracket when organizer', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.findOne.mockResolvedValueOnce(makeBracket());
      const { findMatch } = await import('@gsm/bracket-engine');
      vi.mocked(findMatch).mockReturnValueOnce({
        id: 'm1',
        winner: null,
        player1: { id: 'p1' },
        player2: { id: 'p2' },
      } as any);

      await service.recordResult('bracket-1', { matchId: 'm1', winnerId: 'p1' }, 'org-1', []);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(eventsGateway.emitBracketUpdate).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if not organizer/admin/operator', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      operatorsRepo.count.mockResolvedValue(0);
      await expect(
        service.recordResult('b1', { matchId: 'm1', winnerId: 'p1' }, 'wrong', []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow assigned operator to record result', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.findOne.mockResolvedValueOnce(makeBracket());
      operatorsRepo.count.mockResolvedValue(1);

      await service.recordResult('bracket-1', { matchId: 'm1', winnerId: 'p1' }, 'operator-1', []);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should throw if bracket is locked and user is not admin', async () => {
      repo.findOne.mockResolvedValue(makeBracket({ isLocked: true }));
      await expect(
        service.recordResult('b1', { matchId: 'm1', winnerId: 'p1' }, 'org-1', []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow admin to change result when bracket is locked', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket({ isLocked: true }));
      repo.findOne.mockResolvedValueOnce(makeBracket({ isLocked: true }));

      await service.recordResult('bracket-1', { matchId: 'm1', winnerId: 'p1' }, 'admin-1', [
        'admin',
      ]);
      expect(repo.createQueryBuilder).toHaveBeenCalled();
    });

    it('should fail validation when canRecordResult reports invalid', async () => {
      const { canRecordResult } = await import('@gsm/bracket-engine');
      vi.mocked(canRecordResult).mockReturnValueOnce({
        valid: false,
        errors: ['TBD'],
      });
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(
        service.recordResult('b1', { matchId: 'm1', winnerId: 'p1' }, 'org-1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should fail validation when validateResult reports invalid', async () => {
      const { canRecordResult, validateResult } = await import('@gsm/bracket-engine');
      vi.mocked(canRecordResult).mockReturnValueOnce({ valid: true, errors: [] });
      vi.mocked(validateResult).mockReturnValueOnce({
        valid: false,
        errors: ['bad winner'],
      });
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(
        service.recordResult('b1', { matchId: 'm1', winnerId: 'stranger' }, 'org-1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should require forceCorrect when overwriting an existing result', async () => {
      const { findMatch } = await import('@gsm/bracket-engine');
      vi.mocked(findMatch).mockReturnValueOnce({
        id: 'm1',
        winner: 'p1',
        player1: { id: 'p1' },
        player2: { id: 'p2' },
      } as any);
      repo.findOne.mockResolvedValue(makeBracket());

      await expect(
        service.recordResult('b1', { matchId: 'm1', winnerId: 'p2' }, 'org-1', []),
      ).rejects.toThrow(BadRequestException);
    });

    it('should write audit log entry when recording a new result', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await service.recordResult('bracket-1', { matchId: 'm1', winnerId: 'p1' }, 'org-1', []);
      expect(auditRepo.save).toHaveBeenCalled();
    });
  });

  describe('resetSingleMatch', () => {
    it('should clear a single match and write audit log', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.findOne.mockResolvedValueOnce(makeBracket());

      await service.resetSingleMatch(
        'bracket-1',
        { matchId: 'm1', reason: 'wrong call' },
        'org-1',
        [],
      );

      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(auditRepo.save).toHaveBeenCalled();
      expect(eventsGateway.emitBracketUpdate).toHaveBeenCalled();
    });

    it('should throw if bracket has no data', async () => {
      repo.findOne.mockResolvedValue(makeBracket({ bracketData: null }));
      await expect(service.resetSingleMatch('b1', { matchId: 'm1' }, 'org-1', [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw ForbiddenException for non-organizer / non-admin', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(
        service.resetSingleMatch('b1', { matchId: 'm1' }, 'stranger', []),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should not allow a plain operator to reset a match', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      operatorsRepo.count.mockResolvedValue(1);
      await expect(
        service.resetSingleMatch('b1', { matchId: 'm1' }, 'operator-1', []),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('setLocked', () => {
    it('should lock a bracket when called by organizer', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.findOne.mockResolvedValueOnce(makeBracket({ isLocked: true }));

      await service.setLocked('bracket-1', true, 'org-1', []);
      expect(repo.update).toHaveBeenCalledWith(
        'bracket-1',
        expect.objectContaining({ isLocked: true }),
      );
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('should unlock a bracket when called by admin', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket({ isLocked: true }));
      repo.findOne.mockResolvedValueOnce(makeBracket({ isLocked: false }));

      await service.setLocked('bracket-1', false, 'admin-1', ['admin']);
      expect(repo.update).toHaveBeenCalledWith(
        'bracket-1',
        expect.objectContaining({ isLocked: false }),
      );
    });

    it('should throw for non-authorized user', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(service.setLocked('b1', true, 'stranger', [])).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('reset', () => {
    it('should reset bracket to pending and write audit log', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.findOne.mockResolvedValueOnce(makeBracket({ status: 'pending', bracketData: null }));

      await service.reset('bracket-1', 'org-1', []);

      expect(repo.createQueryBuilder).toHaveBeenCalled();
      expect(auditRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException on concurrent modification', async () => {
      repo.findOne.mockResolvedValueOnce(makeBracket());
      repo.createQueryBuilder.mockReturnValueOnce(makeUpdateQB(0));

      await expect(service.reset('bracket-1', 'org-1', [])).rejects.toThrow(BadRequestException);
    });

    it('should throw if not organizer/admin', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      await expect(service.reset('b1', 'wrong', [])).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getAuditLog', () => {
    it('should return the last 100 audit entries when user has access', async () => {
      const logs = [{ id: 'log-1', action: 'result_recorded' }];
      repo.findOne.mockResolvedValue(makeBracket());
      auditRepo.find.mockResolvedValue(logs);

      const result = await service.getAuditLog('bracket-1', 'org-1', []);
      expect(auditRepo.find).toHaveBeenCalledWith({
        where: { bracketId: 'bracket-1' },
        order: { createdAt: 'DESC' },
        take: 100,
      });
      expect(result).toEqual(logs);
    });

    it('should allow assigned operator to read the log', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      operatorsRepo.count.mockResolvedValue(1);
      auditRepo.find.mockResolvedValue([]);

      await service.getAuditLog('bracket-1', 'operator-1', []);
      expect(auditRepo.find).toHaveBeenCalled();
    });

    it('should throw ForbiddenException for non-organizer / non-admin / non-operator', async () => {
      repo.findOne.mockResolvedValue(makeBracket());
      operatorsRepo.count.mockResolvedValue(0);

      await expect(service.getAuditLog('bracket-1', 'stranger', [])).rejects.toThrow(
        ForbiddenException,
      );
      expect(auditRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('getPendingMatches', () => {
    it('should return matches where both players are real and no winner recorded', () => {
      const bd: any = {
        winnersBracket: [
          [
            {
              id: 'wb_1_0',
              winner: null,
              player1: { id: 'p1' },
              player2: { id: 'p2' },
            },
            {
              id: 'wb_1_1',
              winner: 'p3',
              player1: { id: 'p3' },
              player2: { id: 'p4' },
            },
            {
              id: 'wb_1_2',
              winner: null,
              player1: { id: 'tbd' },
              player2: { id: 'p5' },
            },
          ],
        ],
        losersBracket: [],
        grandFinal: {
          id: 'grand_final',
          winner: null,
          player1: { id: 'tbd' },
          player2: { id: 'tbd' },
        },
        superFinal: { needed: false, winner: null, player1: { id: 'tbd' }, player2: { id: 'tbd' } },
      };

      const pending = service.getPendingMatches(bd);
      expect(pending).toHaveLength(1);
      expect(pending[0].matchId).toBe('wb_1_0');
      expect(pending[0].section).toBe('winners');
    });

    it('should include grand final when both players are known', () => {
      const bd: any = {
        winnersBracket: [],
        losersBracket: [],
        grandFinal: {
          id: 'grand_final',
          winner: null,
          player1: { id: 'p1' },
          player2: { id: 'p2' },
        },
        superFinal: { needed: false, winner: null, player1: { id: 'tbd' }, player2: { id: 'tbd' } },
      };

      const pending = service.getPendingMatches(bd);
      expect(pending.some((p) => p.section === 'grand_final')).toBe(true);
    });
  });
});
