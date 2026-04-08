import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { vi } from 'vitest';
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
    it('should return empty array if no assignments', async () => {
      mockOperatorsRepo.find.mockResolvedValue([]);
      const result = await service.myTournaments('operator-1');
      expect(result).toEqual([]);
    });

    it('should return active tournaments for operator', async () => {
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
    it('should return brackets if operator is assigned', async () => {
      mockOperatorsRepo.findOne.mockResolvedValue({ tournamentId: 't-1', operatorId: 'op-1' });
      mockBracketsService.findByTournament.mockResolvedValue([{ id: 'bracket-1' }]);
      const result = await service.getBrackets('t-1', 'op-1');
      expect(result).toEqual([{ id: 'bracket-1' }]);
    });

    it('should throw ForbiddenException if not assigned', async () => {
      mockOperatorsRepo.findOne.mockResolvedValue(null);
      await expect(service.getBrackets('t-1', 'op-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('recordResult', () => {
    it('should delegate to BracketsService', async () => {
      mockOperatorsRepo.findOne.mockResolvedValue({ tournamentId: 't-1', operatorId: 'op-1' });
      mockBracketsService.recordResult.mockResolvedValue({ id: 'bracket-1', status: 'active' });
      const result = await service.recordResult('bracket-1', 'match-1', 'player-1', 'op-1');
      expect(mockBracketsService.recordResult).toHaveBeenCalledWith(
        'bracket-1',
        'match-1',
        'player-1',
        'op-1',
        [],
      );
      expect(result).toEqual({ id: 'bracket-1', status: 'active' });
    });
  });
});
