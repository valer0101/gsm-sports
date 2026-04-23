import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { MatchAssignmentsService } from './match-assignments.service';
import { MatchTableAssignment } from './entities/match-table-assignment.entity';
import { TournamentTable } from '../tournaments/entities/tournament-table.entity';
import { TournamentOperator } from '../tournaments/entities/tournament-operator.entity';
import { Bracket } from '../brackets/entities/bracket.entity';

const mockRepo = () => ({
  find: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn((v) => v),
  save: vi.fn(async (v) => ({ id: 'assignment-1', ...v })),
  update: vi.fn(),
  count: vi.fn().mockResolvedValue(0),
});

// Build a minimal BracketData blob with a single playable match on a
// specified section. Match id defaults to `wb_1_0`.
const makeBracketData = (
  matchId = 'wb_1_0',
  opts: { winner?: string | null; p1?: string; p2?: string } = {},
) => ({
  winnersBracket: [
    [
      {
        id: matchId,
        winner: opts.winner ?? null,
        player1: { id: opts.p1 ?? 'p1' },
        player2: { id: opts.p2 ?? 'p2' },
      },
    ],
  ],
  losersBracket: [],
  grandFinal: { id: 'grand_final', winner: null, player1: { id: 'tbd' }, player2: { id: 'tbd' } },
  superFinal: { id: 'super_final', needed: false },
});

describe('MatchAssignmentsService', () => {
  let service: MatchAssignmentsService;
  let assignmentsRepo: ReturnType<typeof mockRepo>;
  let tablesRepo: ReturnType<typeof mockRepo>;
  let operatorsRepo: ReturnType<typeof mockRepo>;
  let bracketsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const assignInstance = mockRepo();
    const tableInstance = mockRepo();
    const bracketInstance = mockRepo();

    // Transaction EM returns the same repo instances so assertions work.
    const fakeEm = {
      getRepository: vi.fn((entity: unknown) => {
        if (entity === MatchTableAssignment) return assignInstance;
        if (entity === TournamentTable) return tableInstance;
        if (entity === Bracket) return bracketInstance;
        return mockRepo();
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        MatchAssignmentsService,
        { provide: getRepositoryToken(MatchTableAssignment), useValue: assignInstance },
        { provide: getRepositoryToken(TournamentTable), useValue: tableInstance },
        { provide: getRepositoryToken(TournamentOperator), useFactory: mockRepo },
        { provide: getRepositoryToken(Bracket), useValue: bracketInstance },
        {
          provide: getDataSourceToken(),
          useValue: { transaction: vi.fn(async (cb: any) => cb(fakeEm)) },
        },
      ],
    }).compile();

    service = module.get(MatchAssignmentsService);
    assignmentsRepo = module.get(getRepositoryToken(MatchTableAssignment));
    tablesRepo = module.get(getRepositoryToken(TournamentTable));
    operatorsRepo = module.get(getRepositoryToken(TournamentOperator));
    bracketsRepo = module.get(getRepositoryToken(Bracket));
  });

  afterEach(() => vi.clearAllMocks());

  describe('getActiveByTable', () => {
    it('returns the latest active assignment for a table', async () => {
      const record = { id: 'a-1', tableId: 'table-1' };
      assignmentsRepo.findOne.mockResolvedValue(record);
      const result = await service.getActiveByTable('table-1');
      expect(result).toBe(record);
      expect(assignmentsRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tableId: 'table-1' }),
        }),
      );
    });
  });

  describe('claimNextForTable', () => {
    const setupBracket = (data: unknown) => {
      bracketsRepo.find.mockResolvedValue([
        { id: 'b-1', status: 'active', isLocked: false, bracketData: data },
      ]);
    };

    it('claims the first playable match and flips the table to busy', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: 'table-1',
      });
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', number: 1, status: 'idle' });
      assignmentsRepo.findOne.mockResolvedValue(null); // no active on table
      assignmentsRepo.find.mockResolvedValue([]); // no taken match ids
      setupBracket(makeBracketData('wb_1_0'));

      const result = await service.claimNextForTable('t-1', 'table-1', 'op-1');

      expect(result.matchId).toBe('wb_1_0');
      expect(result.tableId).toBe('table-1');
      expect(result.bracketId).toBe('b-1');
      expect(tablesRepo.update).toHaveBeenCalledWith('table-1', { status: 'busy' });
    });

    it('rejects operator pinned to a different table', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: 'table-2',
      });
      await expect(
        service.claimNextForTable('t-1', 'table-1', 'op-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows roaming operator (tableId=null) to claim any table', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: null,
      });
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', number: 1, status: 'idle' });
      assignmentsRepo.findOne.mockResolvedValue(null);
      assignmentsRepo.find.mockResolvedValue([]);
      setupBracket(makeBracketData('wb_1_0'));

      const result = await service.claimNextForTable('t-1', 'table-1', 'op-1');
      expect(result.matchId).toBe('wb_1_0');
    });

    it('rejects when user is not an operator (no bypass flag)', async () => {
      operatorsRepo.findOne.mockResolvedValue(null);
      await expect(
        service.claimNextForTable('t-1', 'table-1', 'random-user'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('allows organizer bypass even without operator row', async () => {
      operatorsRepo.findOne.mockResolvedValue(null);
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', number: 1, status: 'idle' });
      assignmentsRepo.findOne.mockResolvedValue(null);
      assignmentsRepo.find.mockResolvedValue([]);
      setupBracket(makeBracketData('wb_1_0'));

      const result = await service.claimNextForTable('t-1', 'table-1', 'org-1', {
        isOrganizer: true,
        isAdmin: false,
      });
      expect(result.matchId).toBe('wb_1_0');
      expect(operatorsRepo.findOne).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when table does not belong to tournament', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: null,
      });
      tablesRepo.findOne.mockResolvedValue(null);

      await expect(
        service.claimNextForTable('t-1', 'foreign-table', 'op-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('rejects offline tables', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: null,
      });
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', number: 1, status: 'offline' });

      await expect(
        service.claimNextForTable('t-1', 'table-1', 'op-1'),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects when table already has an active match', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: null,
      });
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', number: 1, status: 'busy' });
      assignmentsRepo.findOne.mockResolvedValue({ id: 'a-existing' });

      await expect(
        service.claimNextForTable('t-1', 'table-1', 'op-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('skips matches that are already claimed elsewhere', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: null,
      });
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', number: 1, status: 'idle' });
      assignmentsRepo.findOne.mockResolvedValue(null);
      assignmentsRepo.find.mockResolvedValue([{ matchId: 'wb_1_0' }]);
      bracketsRepo.find.mockResolvedValue([
        {
          id: 'b-1',
          status: 'active',
          isLocked: false,
          bracketData: {
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
                  winner: null,
                  player1: { id: 'p3' },
                  player2: { id: 'p4' },
                },
              ],
            ],
            losersBracket: [],
            grandFinal: { id: 'gf', winner: null, player1: { id: 'tbd' }, player2: { id: 'tbd' } },
            superFinal: { id: 'sf', needed: false },
          },
        },
      ]);

      const result = await service.claimNextForTable('t-1', 'table-1', 'op-1');
      expect(result.matchId).toBe('wb_1_1');
    });

    it('throws when no claimable matches are available', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: null,
      });
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', number: 1, status: 'idle' });
      assignmentsRepo.findOne.mockResolvedValue(null);
      assignmentsRepo.find.mockResolvedValue([]);
      bracketsRepo.find.mockResolvedValue([]);

      await expect(
        service.claimNextForTable('t-1', 'table-1', 'op-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('skips locked brackets', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: null,
      });
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', number: 1, status: 'idle' });
      assignmentsRepo.findOne.mockResolvedValue(null);
      assignmentsRepo.find.mockResolvedValue([]);
      bracketsRepo.find.mockResolvedValue([
        { id: 'b-1', status: 'active', isLocked: true, bracketData: makeBracketData('wb_1_0') },
      ]);

      await expect(
        service.claimNextForTable('t-1', 'table-1', 'op-1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('translates the 23505 unique-violation into ConflictException (race loser)', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: null,
      });
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', number: 1, status: 'idle' });
      assignmentsRepo.findOne.mockResolvedValue(null);
      assignmentsRepo.find.mockResolvedValue([]);
      bracketsRepo.find.mockResolvedValue([
        { id: 'b-1', status: 'active', isLocked: false, bracketData: makeBracketData('wb_1_0') },
      ]);
      const pgError = Object.assign(new Error('unique violation'), { code: '23505' });
      assignmentsRepo.save.mockRejectedValueOnce(pgError);

      await expect(
        service.claimNextForTable('t-1', 'table-1', 'op-1'),
      ).rejects.toThrow(ConflictException);
    });

    it('ignores TBD/BYE slots', async () => {
      operatorsRepo.findOne.mockResolvedValue({
        tournamentId: 't-1',
        operatorId: 'op-1',
        tableId: null,
      });
      tablesRepo.findOne.mockResolvedValue({ id: 'table-1', number: 1, status: 'idle' });
      assignmentsRepo.findOne.mockResolvedValue(null);
      assignmentsRepo.find.mockResolvedValue([]);
      setupBracket(makeBracketData('wb_1_0', { p1: 'tbd', p2: 'p2' }));

      await expect(
        service.claimNextForTable('t-1', 'table-1', 'op-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('finishForMatch', () => {
    it('marks the active assignment finished and frees the table', async () => {
      assignmentsRepo.findOne.mockResolvedValue({
        id: 'a-1',
        tableId: 'table-1',
        tournamentId: 't-1',
        matchId: 'wb_1_0',
      });
      assignmentsRepo.count.mockResolvedValue(0);

      await service.finishForMatch('t-1', 'wb_1_0');

      expect(assignmentsRepo.update).toHaveBeenCalledWith(
        'a-1',
        expect.objectContaining({ finishedAt: expect.any(Date) }),
      );
      expect(tablesRepo.update).toHaveBeenCalledWith('table-1', { status: 'idle' });
    });

    it('is a no-op when there is no active assignment', async () => {
      assignmentsRepo.findOne.mockResolvedValue(null);
      await service.finishForMatch('t-1', 'wb_1_0');
      expect(assignmentsRepo.update).not.toHaveBeenCalled();
      expect(tablesRepo.update).not.toHaveBeenCalled();
    });

    it('does not flip table to idle if another active assignment remains on it', async () => {
      assignmentsRepo.findOne.mockResolvedValue({
        id: 'a-1',
        tableId: 'table-1',
        tournamentId: 't-1',
        matchId: 'wb_1_0',
      });
      assignmentsRepo.count.mockResolvedValue(1);

      await service.finishForMatch('t-1', 'wb_1_0');

      expect(tablesRepo.update).not.toHaveBeenCalled();
    });
  });
});
