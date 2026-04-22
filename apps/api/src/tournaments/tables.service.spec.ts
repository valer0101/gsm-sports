import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TablesService } from './tables.service';
import { Tournament } from './entities/tournament.entity';
import { TournamentTable } from './entities/tournament-table.entity';

const mockRepo = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn(),
  save: vi.fn(),
  remove: vi.fn(),
});

const makeTable = (o: Partial<TournamentTable> = {}): TournamentTable =>
  ({
    id: 'table-1',
    tournamentId: 'tournament-1',
    tournament: null as any,
    number: 1,
    name: null,
    status: 'idle',
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...o,
  }) as TournamentTable;

const makeTournament = (o: Partial<Tournament> = {}): Tournament =>
  ({ id: 'tournament-1', organizerId: 'organizer-1', ...o }) as Tournament;

describe('TablesService', () => {
  let service: TablesService;
  let tablesRepo: ReturnType<typeof mockRepo>;
  let tournamentsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TablesService,
        { provide: getRepositoryToken(TournamentTable), useFactory: mockRepo },
        { provide: getRepositoryToken(Tournament), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(TablesService);
    tablesRepo = module.get(getRepositoryToken(TournamentTable));
    tournamentsRepo = module.get(getRepositoryToken(Tournament));
  });

  afterEach(() => vi.clearAllMocks());

  describe('findByTournament', () => {
    it('returns tables ordered by number', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      const list = [makeTable({ number: 1 }), makeTable({ id: 't2', number: 2 })];
      tablesRepo.find.mockResolvedValue(list);

      const result = await service.findByTournament('tournament-1');

      expect(result).toBe(list);
      expect(tablesRepo.find).toHaveBeenCalledWith({
        where: { tournamentId: 'tournament-1' },
        order: { number: 'ASC' },
      });
    });

    it('throws NotFoundException when tournament is missing', async () => {
      tournamentsRepo.findOne.mockResolvedValue(null);
      await expect(service.findByTournament('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('creates a table for the organizer', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      tablesRepo.findOne.mockResolvedValue(null);
      tablesRepo.create.mockImplementation((v) => v);
      tablesRepo.save.mockImplementation(async (v) => ({ ...v, id: 'new-table' }));

      const result = await service.create(
        'tournament-1',
        { number: 3, name: 'Court A', status: 'offline' },
        'organizer-1',
      );

      expect(tablesRepo.create).toHaveBeenCalledWith({
        tournamentId: 'tournament-1',
        number: 3,
        name: 'Court A',
        status: 'offline',
        notes: null,
      });
      expect(result.id).toBe('new-table');
    });

    it('defaults status to idle when omitted', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      tablesRepo.findOne.mockResolvedValue(null);
      tablesRepo.create.mockImplementation((v) => v);
      tablesRepo.save.mockImplementation(async (v) => v);

      await service.create('tournament-1', { number: 1 }, 'organizer-1');

      expect(tablesRepo.create).toHaveBeenCalledWith(expect.objectContaining({ status: 'idle' }));
    });

    it('throws ConflictException when number already exists', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      tablesRepo.findOne.mockResolvedValue(makeTable());

      await expect(
        service.create('tournament-1', { number: 1 }, 'organizer-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('throws ForbiddenException when caller is not organizer', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      await expect(
        service.create('tournament-1', { number: 1 }, 'someone-else'),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('update', () => {
    it('updates table fields', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      tablesRepo.findOne.mockResolvedValueOnce(makeTable({ number: 1 }));
      tablesRepo.save.mockImplementation(async (v) => v);

      const result = await service.update(
        'tournament-1',
        'table-1',
        { status: 'busy', notes: 'running quarterfinals' },
        'organizer-1',
      );

      expect(result.status).toBe('busy');
      expect(result.notes).toBe('running quarterfinals');
    });

    it('rejects renumber collisions with a different table', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      tablesRepo.findOne
        .mockResolvedValueOnce(makeTable({ id: 'table-1', number: 1 }))
        .mockResolvedValueOnce(makeTable({ id: 'table-2', number: 2 }));

      await expect(
        service.update('tournament-1', 'table-1', { number: 2 }, 'organizer-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('allows keeping the same number (self-match)', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      tablesRepo.findOne.mockResolvedValueOnce(makeTable({ number: 5 }));
      tablesRepo.save.mockImplementation(async (v) => v);

      const result = await service.update(
        'tournament-1',
        'table-1',
        { number: 5, name: 'renamed' },
        'organizer-1',
      );

      expect(result.number).toBe(5);
      expect(result.name).toBe('renamed');
    });

    it('throws NotFoundException for unknown table', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      tablesRepo.findOne.mockResolvedValue(null);
      await expect(
        service.update('tournament-1', 'missing', { status: 'idle' }, 'organizer-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('deletes the table for the organizer', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      const table = makeTable();
      tablesRepo.findOne.mockResolvedValue(table);

      await service.remove('tournament-1', 'table-1', 'organizer-1');

      expect(tablesRepo.remove).toHaveBeenCalledWith(table);
    });

    it('throws ForbiddenException when caller is not organizer', async () => {
      tournamentsRepo.findOne.mockResolvedValue(makeTournament());
      await expect(
        service.remove('tournament-1', 'table-1', 'someone-else'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
