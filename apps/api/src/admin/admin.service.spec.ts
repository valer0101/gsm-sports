import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AdminService } from './admin.service';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { UsersService } from '../users/users.service';
import { BracketsService } from '../brackets/brackets.service';

const mockTournament = {
  id: 'tournament-1',
  organizerId: 'organizer-1',
  name: 'Test Tournament',
  status: 'draft',
  registrationOpen: false,
  bracketGenerated: false,
} as Tournament;

const mockTournamentsRepo = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
};

const mockOperatorsRepo = {
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

const mockWeightCategoriesRepo = {
  create: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

const mockEntriesRepo = {
  createQueryBuilder: vi.fn(),
  count: vi.fn(),
};

const mockUsersService = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
};

const mockBracketsService = {
  generateForGroup: vi.fn(),
  generateWithWeightBuckets: vi.fn(),
  findByTournament: vi.fn(),
  findById: vi.fn(),
  recordResult: vi.fn(),
  resetSingleMatch: vi.fn(),
  setLocked: vi.fn(),
  getAuditLog: vi.fn(),
};

const mockDataSource = {
  getRepository: vi.fn(),
};

describe('AdminService', () => {
  let service: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: getRepositoryToken(Tournament), useValue: mockTournamentsRepo },
        { provide: getRepositoryToken(TournamentOperator), useValue: mockOperatorsRepo },
        { provide: getRepositoryToken(WeightCategory), useValue: mockWeightCategoriesRepo },
        { provide: getRepositoryToken(TournamentEntry), useValue: mockEntriesRepo },
        { provide: UsersService, useValue: mockUsersService },
        { provide: BracketsService, useValue: mockBracketsService },
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('listTournaments', () => {
    it('returns own tournaments for organizer', async () => {
      mockTournamentsRepo.find.mockResolvedValue([mockTournament]);
      const result = await service.listTournaments('organizer-1', ['organizer']);
      expect(mockTournamentsRepo.find).toHaveBeenCalledWith({
        where: { organizerId: 'organizer-1' },
        relations: ['sport'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockTournament]);
    });

    it('returns all tournaments for admin', async () => {
      mockTournamentsRepo.find.mockResolvedValue([mockTournament]);
      await service.listTournaments('admin-1', ['admin']);
      expect(mockTournamentsRepo.find).toHaveBeenCalledWith({
        where: {},
        relations: ['sport'],
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getTournament', () => {
    it('returns tournament if user is organizer', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      const result = await service.getTournament('tournament-1', 'organizer-1', ['organizer']);
      expect(result).toEqual(mockTournament);
    });

    it('allows admin to access any tournament', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, organizerId: 'other' });
      const result = await service.getTournament('tournament-1', 'admin-1', ['admin']);
      expect(result.id).toBe('tournament-1');
    });

    it('throws NotFoundException if tournament not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(null);
      await expect(service.getTournament('bad-id', 'organizer-1', [])).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException if user is not owner and not admin', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, organizerId: 'other' });
      await expect(
        service.getTournament('tournament-1', 'organizer-1', ['organizer']),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteTournament', () => {
    it('deletes tournament in draft status', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, status: 'draft' });
      mockTournamentsRepo.delete.mockResolvedValue({ affected: 1 });
      await service.deleteTournament('tournament-1', 'organizer-1', ['organizer']);
      expect(mockTournamentsRepo.delete).toHaveBeenCalledWith('tournament-1');
    });

    it('throws BadRequestException for active tournament', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, status: 'active' });
      await expect(
        service.deleteTournament('tournament-1', 'organizer-1', ['organizer']),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('toggleRegistration', () => {
    it('opens registration when closed', async () => {
      mockTournamentsRepo.findOne
        .mockResolvedValueOnce({ ...mockTournament, registrationOpen: false })
        .mockResolvedValueOnce({ ...mockTournament, registrationOpen: true });
      mockTournamentsRepo.update.mockResolvedValue({});
      await service.toggleRegistration('tournament-1', 'organizer-1', ['organizer']);
      expect(mockTournamentsRepo.update).toHaveBeenCalled();
    });

    it('throws BadRequestException if bracket already generated', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, bracketGenerated: true });
      await expect(
        service.toggleRegistration('tournament-1', 'organizer-1', ['organizer']),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('closeAndGenerateBrackets', () => {
    it('delegates to BracketsService.generateWithWeightBuckets', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        bracketGenerated: false,
      });
      mockBracketsService.generateWithWeightBuckets.mockResolvedValue(3);
      const result = await service.closeAndGenerateBrackets('tournament-1', 'organizer-1', [
        'organizer',
      ]);
      expect(result).toEqual({ bracketsCreated: 3 });
      expect(mockBracketsService.generateWithWeightBuckets).toHaveBeenCalledWith('tournament-1');
    });

    it('throws BadRequestException if bracket already generated', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        bracketGenerated: true,
      });
      await expect(
        service.closeAndGenerateBrackets('tournament-1', 'organizer-1', ['organizer']),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('assignOperator', () => {
    it('throws NotFoundException if user email not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockUsersService.findByEmail.mockResolvedValue(null);
      await expect(
        service.assignOperator('tournament-1', 'unknown@test.com', 'organizer-1', ['organizer']),
      ).rejects.toThrow(NotFoundException);
    });

    it('assigns operator if user exists and not already assigned', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockUsersService.findByEmail.mockResolvedValue({
        id: 'user-2',
        email: 'op@test.com',
        firstName: 'Op',
        lastName: 'User',
      });
      mockOperatorsRepo.findOne.mockResolvedValue(null);
      mockOperatorsRepo.create.mockReturnValue({
        tournamentId: 'tournament-1',
        operatorId: 'user-2',
      });
      mockOperatorsRepo.save.mockResolvedValue({ id: 'op-1' });
      await service.assignOperator('tournament-1', 'op@test.com', 'organizer-1', ['organizer']);
      expect(mockOperatorsRepo.save).toHaveBeenCalled();
    });
  });

  // ─── Bracket management ──────────────────────────────────

  describe('getBrackets', () => {
    it('returns all brackets for a tournament that the user can access', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockBracketsService.findByTournament.mockResolvedValue([{ id: 'bracket-1' }]);
      const result = await service.getBrackets('tournament-1', 'organizer-1', ['organizer']);
      expect(result).toEqual([{ id: 'bracket-1' }]);
      expect(mockBracketsService.findByTournament).toHaveBeenCalledWith('tournament-1');
    });

    it('throws ForbiddenException when user is not the organizer and not admin', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, organizerId: 'other' });
      await expect(
        service.getBrackets('tournament-1', 'organizer-1', ['organizer']),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('correctMatchResult', () => {
    it('delegates to BracketsService.recordResult with forceCorrect=true', async () => {
      mockBracketsService.recordResult.mockResolvedValue({ id: 'bracket-1' });
      await service.correctMatchResult(
        'bracket-1',
        'wb_1_0',
        'p2',
        'admin-1',
        ['admin'],
        'wrong call',
      );
      expect(mockBracketsService.recordResult).toHaveBeenCalledWith(
        'bracket-1',
        { matchId: 'wb_1_0', winnerId: 'p2', notes: 'wrong call', forceCorrect: true },
        'admin-1',
        ['admin'],
      );
    });

    it('throws BadRequestException when reason is missing', async () => {
      await expect(
        service.correctMatchResult('bracket-1', 'wb_1_0', 'p2', 'admin-1', ['admin']),
      ).rejects.toThrow(BadRequestException);
      expect(mockBracketsService.recordResult).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when reason is only whitespace', async () => {
      await expect(
        service.correctMatchResult('bracket-1', 'wb_1_0', 'p2', 'admin-1', ['admin'], '   '),
      ).rejects.toThrow(BadRequestException);
      expect(mockBracketsService.recordResult).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when reason is shorter than 3 chars', async () => {
      await expect(
        service.correctMatchResult('bracket-1', 'wb_1_0', 'p2', 'admin-1', ['admin'], 'ok'),
      ).rejects.toThrow(BadRequestException);
      expect(mockBracketsService.recordResult).not.toHaveBeenCalled();
    });
  });

  describe('resetMatch', () => {
    it('delegates to BracketsService.resetSingleMatch with reason', async () => {
      mockBracketsService.resetSingleMatch.mockResolvedValue({ id: 'bracket-1' });
      await service.resetMatch('bracket-1', 'wb_1_0', 'organizer-1', ['organizer'], 'disputed');
      expect(mockBracketsService.resetSingleMatch).toHaveBeenCalledWith(
        'bracket-1',
        { matchId: 'wb_1_0', reason: 'disputed' },
        'organizer-1',
        ['organizer'],
      );
    });
  });

  describe('lockBracket / unlockBracket', () => {
    it('calls setLocked(true) for lockBracket', async () => {
      mockBracketsService.setLocked.mockResolvedValue({ id: 'bracket-1', isLocked: true });
      await service.lockBracket('bracket-1', 'organizer-1', ['organizer']);
      expect(mockBracketsService.setLocked).toHaveBeenCalledWith('bracket-1', true, 'organizer-1', [
        'organizer',
      ]);
    });

    it('calls setLocked(false) for unlockBracket', async () => {
      mockBracketsService.setLocked.mockResolvedValue({ id: 'bracket-1', isLocked: false });
      await service.unlockBracket('bracket-1', 'admin-1', ['admin']);
      expect(mockBracketsService.setLocked).toHaveBeenCalledWith('bracket-1', false, 'admin-1', [
        'admin',
      ]);
    });
  });

  describe('getBracketAuditLog', () => {
    it('verifies access and returns audit log', async () => {
      mockBracketsService.findById.mockResolvedValue({ tournamentId: 'tournament-1' });
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockBracketsService.getAuditLog.mockResolvedValue([{ id: 'log-1' }]);

      const result = await service.getBracketAuditLog('bracket-1', 'organizer-1', ['organizer']);
      expect(result).toEqual([{ id: 'log-1' }]);
      expect(mockBracketsService.getAuditLog).toHaveBeenCalledWith('bracket-1', 'organizer-1', [
        'organizer',
      ]);
    });

    it('throws ForbiddenException when user cannot access the parent tournament', async () => {
      mockBracketsService.findById.mockResolvedValue({ tournamentId: 'tournament-1' });
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        organizerId: 'someone-else',
      });
      await expect(
        service.getBracketAuditLog('bracket-1', 'organizer-1', ['organizer']),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
