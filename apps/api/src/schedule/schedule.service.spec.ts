import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Bracket } from '../brackets/entities/bracket.entity';
import { TournamentTable } from '../tournaments/entities/tournament-table.entity';
import { MatchTableAssignment } from '../match-assignments/entities/match-table-assignment.entity';

const mockRepo = () => ({
  findOne: vi.fn(),
  find: vi.fn(),
});

const makeTournament = (overrides: Record<string, unknown> = {}) => ({
  id: 'tournament-1',
  sportConfig: null,
  sport: {
    slug: 'armwrestling',
    config: {
      categoriesType: 'weight',
      hasHands: true,
      bracketFormats: ['double_elim'],
      defaultBracketFormat: 'double_elim',
      matchResultSchema: 'armwrestling',
      weighInRequired: true,
      avgMatchDurationSec: 180,
      minRestBetweenMatchesSec: 600,
    },
  },
  ...overrides,
});

const bracketWithOneMatch = (id: string, matchId: string, p1: string, p2: string) => ({
  id,
  status: 'active',
  isLocked: false,
  createdAt: new Date('2026-05-01'),
  bracketData: {
    players: [],
    bracketSize: 2,
    wbRounds: 1,
    winnersBracket: [
      [
        {
          id: matchId,
          winner: null,
          player1: { id: p1 },
          player2: { id: p2 },
        },
      ],
    ],
    losersBracket: [],
    grandFinal: { id: 'gf', winner: null, player1: { id: 'tbd' }, player2: { id: 'tbd' } },
    superFinal: { id: 'sf', needed: false },
  },
});

describe('ScheduleService', () => {
  let service: ScheduleService;
  let tournamentsRepo: ReturnType<typeof mockRepo>;
  let bracketsRepo: ReturnType<typeof mockRepo>;
  let tablesRepo: ReturnType<typeof mockRepo>;
  let assignmentsRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        ScheduleService,
        { provide: getRepositoryToken(Tournament), useFactory: mockRepo },
        { provide: getRepositoryToken(Bracket), useFactory: mockRepo },
        { provide: getRepositoryToken(TournamentTable), useFactory: mockRepo },
        { provide: getRepositoryToken(MatchTableAssignment), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(ScheduleService);
    tournamentsRepo = module.get(getRepositoryToken(Tournament));
    bracketsRepo = module.get(getRepositoryToken(Bracket));
    tablesRepo = module.get(getRepositoryToken(TournamentTable));
    assignmentsRepo = module.get(getRepositoryToken(MatchTableAssignment));
  });

  afterEach(() => vi.clearAllMocks());

  it('throws NotFoundException when the tournament does not exist', async () => {
    tournamentsRepo.findOne.mockResolvedValue(null);
    await expect(service.getForTournament('missing')).rejects.toThrow(NotFoundException);
  });

  it('schedules pending matches on idle tables using sport timing defaults', async () => {
    tournamentsRepo.findOne.mockResolvedValue(makeTournament());
    tablesRepo.find.mockResolvedValue([
      { id: 't1', status: 'idle', number: 1 },
      { id: 't2', status: 'idle', number: 2 },
    ]);
    bracketsRepo.find.mockResolvedValue([
      bracketWithOneMatch('b1', 'm1', 'a', 'b'),
    ]);
    assignmentsRepo.find.mockResolvedValue([]);

    const out = await service.getForTournament('tournament-1');

    expect(out.scheduled).toHaveLength(1);
    expect(out.scheduled[0].matchId).toBe('m1');
    expect(out.scheduled[0].tableId).toBe('t1'); // tie-break ascending
    expect(out.scheduled[0].estimatedEndAt - out.scheduled[0].estimatedStartAt).toBe(
      180 * 1000,
    ); // armwrestling default
  });

  it('applies per-tournament override for duration + min-rest', async () => {
    tournamentsRepo.findOne.mockResolvedValue(
      makeTournament({
        sportConfig: { avgMatchDurationSec: 60, minRestBetweenMatchesSec: 30 },
      }),
    );
    tablesRepo.find.mockResolvedValue([{ id: 't1', status: 'idle', number: 1 }]);
    bracketsRepo.find.mockResolvedValue([bracketWithOneMatch('b1', 'm1', 'a', 'b')]);
    assignmentsRepo.find.mockResolvedValue([]);

    const out = await service.getForTournament('tournament-1');

    expect(out.scheduled[0].estimatedEndAt - out.scheduled[0].estimatedStartAt).toBe(60 * 1000);
  });

  it('marks tables with active assignments as busy with ETA from startedAt + duration', async () => {
    const started = new Date(Date.now() - 60_000); // started 60s ago
    tournamentsRepo.findOne.mockResolvedValue(makeTournament());
    tablesRepo.find.mockResolvedValue([
      { id: 't1', status: 'busy', number: 1 },
      { id: 't2', status: 'idle', number: 2 },
    ]);
    bracketsRepo.find.mockResolvedValue([
      // Two pending matches — one is already on table 1 (active assignment),
      // the other is truly pending and must go to t2.
      {
        id: 'b1',
        status: 'active',
        isLocked: false,
        createdAt: new Date('2026-05-01'),
        bracketData: {
          players: [],
          bracketSize: 4,
          wbRounds: 2,
          winnersBracket: [
            [
              { id: 'm-running', winner: null, player1: { id: 'a' }, player2: { id: 'b' } },
              { id: 'm-pending', winner: null, player1: { id: 'c' }, player2: { id: 'd' } },
            ],
          ],
          losersBracket: [],
          grandFinal: { id: 'gf', winner: null, player1: { id: 'tbd' }, player2: { id: 'tbd' } },
          superFinal: { id: 'sf', needed: false },
        },
      },
    ]);
    assignmentsRepo.find.mockResolvedValue([
      {
        id: 'a1',
        tournamentId: 'tournament-1',
        bracketId: 'b1',
        matchId: 'm-running',
        tableId: 't1',
        startedAt: started,
        assignedAt: started,
        finishedAt: null,
      },
    ]);

    const out = await service.getForTournament('tournament-1');

    // Only m-pending should be scheduled (m-running is already claimed).
    expect(out.scheduled).toHaveLength(1);
    expect(out.scheduled[0].matchId).toBe('m-pending');
    // Must go to t2 because t1 is busy.
    expect(out.scheduled[0].tableId).toBe('t2');
    // The running match is exposed separately so the arena can render it.
    expect(out.active).toHaveLength(1);
    expect(out.active[0]).toEqual(
      expect.objectContaining({
        matchId: 'm-running',
        tableId: 't1',
        bracketId: 'b1',
      }),
    );
    expect(out.active[0].estimatedEndAt).toBe(started.getTime() + 180 * 1000);
  });

  it('skips locked and non-active brackets', async () => {
    tournamentsRepo.findOne.mockResolvedValue(makeTournament());
    tablesRepo.find.mockResolvedValue([{ id: 't1', status: 'idle', number: 1 }]);
    bracketsRepo.find.mockResolvedValue([
      { ...bracketWithOneMatch('b-locked', 'm1', 'a', 'b'), isLocked: true },
      { ...bracketWithOneMatch('b-completed', 'm2', 'c', 'd'), status: 'completed' },
    ]);
    assignmentsRepo.find.mockResolvedValue([]);

    const out = await service.getForTournament('tournament-1');

    expect(out.scheduled).toEqual([]);
  });

  it('does NOT double-book an athlete who is currently playing on another table', async () => {
    // Scenario that originally failed review on PR #17: A is in an active
    // assignment on t1 (started 30s ago; avg 180s → busy until +150s). A also
    // has a pending match in LB. Without seeding activeByTable into
    // athleteLastFinishAt, the scheduler would place that pending match NOW
    // on t2.
    const startedAt = new Date(Date.now() - 30_000);
    tournamentsRepo.findOne.mockResolvedValue(makeTournament());
    tablesRepo.find.mockResolvedValue([
      { id: 't1', status: 'busy', number: 1 },
      { id: 't2', status: 'idle', number: 2 },
    ]);
    bracketsRepo.find.mockResolvedValue([
      {
        id: 'b1',
        status: 'active',
        isLocked: false,
        createdAt: new Date('2026-05-01'),
        bracketData: {
          players: [],
          bracketSize: 4,
          wbRounds: 2,
          winnersBracket: [
            [
              // A is playing this one on t1 right now.
              { id: 'running', winner: null, player1: { id: 'a' }, player2: { id: 'b' } },
            ],
          ],
          losersBracket: [
            [
              // A's next match — should wait for t1 + rest.
              { id: 'a-next', winner: null, player1: { id: 'a' }, player2: { id: 'c' } },
            ],
          ],
          grandFinal: { id: 'gf', winner: null, player1: { id: 'tbd' }, player2: { id: 'tbd' } },
          superFinal: { id: 'sf', needed: false },
        },
      },
    ]);
    assignmentsRepo.find.mockResolvedValue([
      {
        id: 'a-running',
        tournamentId: 'tournament-1',
        bracketId: 'b1',
        matchId: 'running',
        tableId: 't1',
        startedAt,
        assignedAt: startedAt,
        finishedAt: null,
      },
    ]);

    const out = await service.getForTournament('tournament-1');

    expect(out.scheduled).toHaveLength(1);
    const aNext = out.scheduled[0];
    expect(aNext.matchId).toBe('a-next');
    // ETA floor: startedAt + avgDuration(180s) + minRest(600s) = +750s
    // from startedAt. Must be AT LEAST that.
    const projectedEnd = startedAt.getTime() + 180 * 1000;
    const expectedEarliest = projectedEnd + 600 * 1000;
    expect(aNext.estimatedStartAt).toBeGreaterThanOrEqual(expectedEarliest - 1);
  });

  it('seeds athleteLastFinishAt from finished assignments so rest applies across runs', async () => {
    const finishedAt = new Date(Date.now() - 60_000); // athlete A finished 60s ago
    tournamentsRepo.findOne.mockResolvedValue(makeTournament());
    tablesRepo.find.mockResolvedValue([{ id: 't1', status: 'idle', number: 1 }]);
    // Bracket has both finished match (so we can trace A's history) and a
    // pending one where A plays again.
    bracketsRepo.find.mockResolvedValue([
      {
        id: 'b1',
        status: 'active',
        isLocked: false,
        createdAt: new Date('2026-05-01'),
        bracketData: {
          players: [],
          bracketSize: 4,
          wbRounds: 2,
          winnersBracket: [
            [
              { id: 'done', winner: 'a', player1: { id: 'a' }, player2: { id: 'b' } },
              { id: 'pending', winner: null, player1: { id: 'a' }, player2: { id: 'c' } },
            ],
          ],
          losersBracket: [],
          grandFinal: { id: 'gf', winner: null, player1: { id: 'tbd' }, player2: { id: 'tbd' } },
          superFinal: { id: 'sf', needed: false },
        },
      },
    ]);
    assignmentsRepo.find.mockResolvedValue([
      {
        id: 'a-done',
        tournamentId: 'tournament-1',
        bracketId: 'b1',
        matchId: 'done',
        tableId: 't1',
        startedAt: finishedAt,
        assignedAt: finishedAt,
        finishedAt,
      },
    ]);

    const out = await service.getForTournament('tournament-1');

    // Armwrestling default rest = 600s. A finished 60s ago → pending match
    // must start at finishedAt + 600s, not "now".
    const expectedEarliest = finishedAt.getTime() + 600 * 1000;
    expect(out.scheduled[0].estimatedStartAt).toBeGreaterThanOrEqual(expectedEarliest - 1);
  });
});
