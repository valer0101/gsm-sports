import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { vi } from 'vitest';
import { AdminService } from './admin.service';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { WeightCategory } from '../tournaments/entities/weight-category.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';
import { User } from '../users/entities/user.entity';
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
};

const mockUsersRepo = {
  findOne: vi.fn(),
};

const mockBracketsService = {
  generateForGroup: vi.fn(),
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
        { provide: getRepositoryToken(User), useValue: mockUsersRepo },
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
    it('should return tournaments for organizer', async () => {
      mockTournamentsRepo.find.mockResolvedValue([mockTournament]);
      const result = await service.listTournaments('organizer-1');
      expect(mockTournamentsRepo.find).toHaveBeenCalledWith({
        where: { organizerId: 'organizer-1' },
        relations: ['sport'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual([mockTournament]);
    });
  });

  describe('getTournament', () => {
    it('should return tournament if it belongs to organizer', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      const result = await service.getTournament('tournament-1', 'organizer-1');
      expect(result).toEqual(mockTournament);
    });

    it('should throw NotFoundException if tournament not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(null);
      await expect(service.getTournament('bad-id', 'organizer-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not owner', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, organizerId: 'other' });
      await expect(service.getTournament('tournament-1', 'organizer-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteTournament', () => {
    it('should delete tournament in draft status', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, status: 'draft' });
      mockTournamentsRepo.delete.mockResolvedValue({ affected: 1 });
      await service.deleteTournament('tournament-1', 'organizer-1');
      expect(mockTournamentsRepo.delete).toHaveBeenCalledWith('tournament-1');
    });

    it('should throw BadRequestException for active tournament', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, status: 'active' });
      await expect(service.deleteTournament('tournament-1', 'organizer-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException for completed tournament', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, status: 'completed' });
      await expect(service.deleteTournament('tournament-1', 'organizer-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('toggleRegistration', () => {
    it('should open registration when closed', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({
        ...mockTournament,
        registrationOpen: false,
        bracketGenerated: false,
      });
      mockTournamentsRepo.update.mockResolvedValue({});
      mockTournamentsRepo.findOne
        .mockResolvedValueOnce({ ...mockTournament, registrationOpen: false })
        .mockResolvedValueOnce({ ...mockTournament, registrationOpen: true });
      await service.toggleRegistration('tournament-1', 'organizer-1');
      expect(mockTournamentsRepo.update).toHaveBeenCalled();
    });

    it('should throw BadRequestException if bracket already generated', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue({ ...mockTournament, bracketGenerated: true });
      await expect(service.toggleRegistration('tournament-1', 'organizer-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('assignOperator', () => {
    it('should throw NotFoundException if user email not found', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockUsersRepo.findOne.mockResolvedValue(null);
      await expect(
        service.assignOperator('tournament-1', 'unknown@test.com', 'organizer-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should assign operator if user exists and not already assigned', async () => {
      mockTournamentsRepo.findOne.mockResolvedValue(mockTournament);
      mockUsersRepo.findOne.mockResolvedValue({ id: 'user-2', email: 'op@test.com' });
      mockOperatorsRepo.findOne.mockResolvedValue(null);
      mockOperatorsRepo.create.mockReturnValue({
        tournamentId: 'tournament-1',
        operatorId: 'user-2',
      });
      mockOperatorsRepo.save.mockResolvedValue({ id: 'op-1' });
      await service.assignOperator('tournament-1', 'op@test.com', 'organizer-1');
      expect(mockOperatorsRepo.save).toHaveBeenCalled();
    });
  });
});
