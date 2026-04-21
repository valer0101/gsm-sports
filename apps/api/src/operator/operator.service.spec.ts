import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { OperatorService } from './operator.service';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { BracketsService } from '../brackets/brackets.service';

const mockOperatorsRepo = {
  find: vi.fn(),
  findOne: vi.fn(),
};

const mockTournamentsRepo = {
  createQueryBuilder: vi.fn(),
};

const mockBracketsService = {
  findByTournament: vi.fn(),
  recordResult: vi.fn(),
  getPendingMatches: vi.fn(),
};

describe('OperatorService', () => {
  let service: OperatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OperatorService,
        { provide: getRepositoryToken(TournamentOperator), useValue: mockOperatorsRepo },
        { provide: getRepositoryToken(Tournament), useValue: mockTournamentsRepo },
        { provide: BracketsService, useValue: mockBracketsService },
      ],
    }).compile();

    service = module.get<OperatorService>(OperatorService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('myTournaments', () => {
    it('returns empty array if no assignments', async () => {
      mockOperatorsRepo.find.mockResolvedValue([]);
      const result = await service.myTournaments('operator-1');
      expect(result).toEqual([]);
    });

    it('returns active tournaments for operator', async () => {
      const mockAssignments = [{ tournamentId: 'tournament-1', operatorId: 'operator-1' }];
      const mockTournaments = [{ id: 'tournament-1', status: 'registration_open' }];
      const mockQb = {
        leftJoinAndSelect: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue(mockTournaments),
      };
      mockOperatorsRepo.find.mockResolvedValue(mockAssignments);
      mockTournamentsRepo.createQueryBuilder.mockReturnValue(mockQb);
      const result = await service.myTournaments('operator-1');
      expect(result).toEqual(mockTournaments);
    });
  });

  describe('getBrackets', () => {
    it('returns brackets when operator is assigned', async () => {
      mockOperatorsRepo.findOne.mockResolvedValue({ tournamentId: 't-1', operatorId: 'op-1' });
      mockBracketsService.findByTournament.mockResolvedValue([{ id: 'bracket-1' }]);
      const result = await service.getBrackets('t-1', 'op-1');
      expect(result).toEqual([{ id: 'bracket-1' }]);
    });

    it('throws ForbiddenException if operator is not assigned', async () => {
      mockOperatorsRepo.findOne.mockResolvedValue(null);
      await expect(service.getBrackets('t-1', 'op-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('recordResult', () => {
    it('delegates to BracketsService with DTO including notes', async () => {
      mockBracketsService.recordResult.mockResolvedValue({ id: 'bracket-1', status: 'active' });
      const result = await service.recordResult(
        'bracket-1',
        'match-1',
        'player-1',
        'op-1',
        'short note',
      );
      expect(mockBracketsService.recordResult).toHaveBeenCalledWith(
        'bracket-1',
        { matchId: 'match-1', winnerId: 'player-1', notes: 'short note' },
        'op-1',
        [],
      );
      expect(result).toEqual({ id: 'bracket-1', status: 'active' });
    });

    it('works without notes', async () => {
      mockBracketsService.recordResult.mockResolvedValue({ id: 'bracket-1' });
      await service.recordResult('bracket-1', 'match-1', 'player-1', 'op-1');
      expect(mockBracketsService.recordResult).toHaveBeenCalledWith(
        'bracket-1',
        { matchId: 'match-1', winnerId: 'player-1', notes: undefined },
        'op-1',
        [],
      );
    });
  });

  describe('getPendingMatches', () => {
    it('throws ForbiddenException if operator is not assigned', async () => {
      mockOperatorsRepo.findOne.mockResolvedValue(null);
      await expect(service.getPendingMatches('t-1', 'op-1')).rejects.toThrow(ForbiddenException);
    });

    it('returns only active brackets with pending matches', async () => {
      mockOperatorsRepo.findOne.mockResolvedValue({ tournamentId: 't-1', operatorId: 'op-1' });
      mockBracketsService.findByTournament.mockResolvedValue([
        {
          id: 'b-active-with-pending',
          name: 'Cat A',
          status: 'active',
          isLocked: false,
          bracketData: { some: 'data' },
        },
        {
          id: 'b-active-empty',
          name: 'Cat B',
          status: 'active',
          isLocked: false,
          bracketData: { some: 'data' },
        },
        {
          id: 'b-completed',
          name: 'Cat C',
          status: 'completed',
          isLocked: false,
          bracketData: { some: 'data' },
        },
        {
          id: 'b-no-data',
          name: 'Cat D',
          status: 'active',
          isLocked: false,
          bracketData: null,
        },
      ]);
      mockBracketsService.getPendingMatches
        .mockReturnValueOnce([
          { matchId: 'wb_1_0', player1: {}, player2: {}, section: 'winners' },
        ])
        .mockReturnValueOnce([]);

      const result = await service.getPendingMatches('t-1', 'op-1');
      expect(result).toHaveLength(1);
      expect(result[0].bracketId).toBe('b-active-with-pending');
      expect(result[0].bracketName).toBe('Cat A');
      expect(result[0].pendingMatches).toHaveLength(1);
    });

    it('exposes the isLocked flag so UI can disable controls', async () => {
      mockOperatorsRepo.findOne.mockResolvedValue({ tournamentId: 't-1', operatorId: 'op-1' });
      mockBracketsService.findByTournament.mockResolvedValue([
        {
          id: 'b-1',
          name: 'Locked',
          status: 'active',
          isLocked: true,
          bracketData: {},
        },
      ]);
      mockBracketsService.getPendingMatches.mockReturnValueOnce([
        { matchId: 'wb_1_0', player1: {}, player2: {}, section: 'winners' },
      ]);

      const result = await service.getPendingMatches('t-1', 'op-1');
      expect(result[0].isLocked).toBe(true);
    });
  });
});
