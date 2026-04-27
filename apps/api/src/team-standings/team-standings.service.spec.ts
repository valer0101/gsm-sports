import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { generateSingleElimination, selectWinner } from '@gsm/bracket-engine';
import type { Player } from '@gsm/bracket-engine';
import { TeamStandingsService } from './team-standings.service';
import { Tournament } from '../tournaments/entities/tournament.entity';
import { Bracket } from '../brackets/entities/bracket.entity';
import { TournamentEntry } from '../entries/entities/tournament-entry.entity';

const mockRepo = () => ({
  findOne: vi.fn(),
  find: vi.fn(),
});

/**
 * Builds a fully-resolved 4-player single-elim bracket where
 * `entryA` wins, `entryB` is runner-up, `entryC` and `entryD`
 * are tied at 3rd. Player ids are entry ids — that's the convention
 * `BracketsService.createBracket` uses when seeding from entries.
 */
function buildFinishedBracket(
  bracketId: string,
  name: string,
  entries: { entryA: string; entryB: string; entryC: string; entryD: string },
) {
  const players: Player[] = [
    { id: entries.entryA, firstName: 'A', lastName: '', number: 1 },
    { id: entries.entryC, firstName: 'C', lastName: '', number: 2 },
    { id: entries.entryB, firstName: 'B', lastName: '', number: 3 },
    { id: entries.entryD, firstName: 'D', lastName: '', number: 4 },
  ];
  let data = generateSingleElimination(players);
  data = selectWinner(data, 'wb_1_0', entries.entryA);
  data = selectWinner(data, 'wb_1_1', entries.entryB);
  data = selectWinner(data, 'wb_2_0', entries.entryA);
  return {
    id: bracketId,
    tournamentId: 'tournament-1',
    name,
    bracketData: data,
  };
}

const makeTournament = (overrides: Record<string, unknown> = {}) => ({
  id: 'tournament-1',
  sportConfig: null,
  sport: {
    slug: 'armwrestling',
    config: null,
  },
  ...overrides,
});

describe('TeamStandingsService', () => {
  let service: TeamStandingsService;
  let tournamentsRepo: ReturnType<typeof mockRepo>;
  let bracketsRepo: ReturnType<typeof mockRepo>;
  let entriesRepo: ReturnType<typeof mockRepo>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        TeamStandingsService,
        { provide: getRepositoryToken(Tournament), useFactory: mockRepo },
        { provide: getRepositoryToken(Bracket), useFactory: mockRepo },
        { provide: getRepositoryToken(TournamentEntry), useFactory: mockRepo },
      ],
    }).compile();

    service = module.get(TeamStandingsService);
    tournamentsRepo = module.get(getRepositoryToken(Tournament));
    bracketsRepo = module.get(getRepositoryToken(Bracket));
    entriesRepo = module.get(getRepositoryToken(TournamentEntry));
  });

  it('throws NotFound when tournament is missing', async () => {
    tournamentsRepo.findOne.mockResolvedValue(null);
    await expect(service.getForTournament('missing')).rejects.toThrow(NotFoundException);
  });

  it('returns empty rows when tournament has no brackets', async () => {
    tournamentsRepo.findOne.mockResolvedValue(makeTournament());
    bracketsRepo.find.mockResolvedValue([]);
    const out = await service.getForTournament('tournament-1');
    expect(out.rows).toEqual([]);
    expect(out.tournamentId).toBe('tournament-1');
    // Default WAF scoring echoed back even on empty result so the UI
    // can still render the legend.
    expect(out.pointsByPlace).toEqual({ 1: 7, 2: 5, 3: 3, 4: 1 });
  });

  it('aggregates one finished bracket into a country leaderboard', async () => {
    tournamentsRepo.findOne.mockResolvedValue(makeTournament());
    bracketsRepo.find.mockResolvedValue([
      buildFinishedBracket('bracket-1', 'M -70kg', {
        entryA: 'entry-a',
        entryB: 'entry-b',
        entryC: 'entry-c',
        entryD: 'entry-d',
      }),
    ]);
    entriesRepo.find.mockResolvedValue([
      { id: 'entry-a', userId: 'user-a', athleteCountry: 'AM' },
      { id: 'entry-b', userId: 'user-b', athleteCountry: 'GE' },
      { id: 'entry-c', userId: 'user-c', athleteCountry: 'AM' },
      { id: 'entry-d', userId: 'user-d', athleteCountry: 'AM' },
    ]);

    const out = await service.getForTournament('tournament-1');

    // AM has gold (7) + two tied bronzes (3 + 3) = 13 pts.
    // GE has silver (5) = 5 pts.
    expect(out.rows).toHaveLength(2);
    expect(out.rows[0]).toMatchObject({
      team: 'AM',
      position: 1,
      points: 13,
      athletesScoring: 3,
    });
    expect(out.rows[1]).toMatchObject({
      team: 'GE',
      position: 2,
      points: 5,
      athletesScoring: 1,
    });
    // Breakdown carries the full provenance trail — entryId, NOT userId
    // (this is a public endpoint and must not leak user UUIDs).
    expect(out.rows[0].breakdown).toHaveLength(3);
    expect(out.rows[0].breakdown[0]).toMatchObject({
      bracketId: 'bracket-1',
      category: 'M -70kg',
      entryId: 'entry-a',
      placement: 1,
      points: 7,
    });
    // Defensive: the wire shape does NOT carry userId at any depth.
    for (const row of out.rows) {
      for (const item of row.breakdown) {
        expect(item).not.toHaveProperty('userId');
      }
    }
  });

  it('drops placements outside the scoring scheme', async () => {
    // 8-player bracket: champion + runner-up + 2 SF (all score) +
    // 4 QF losers tied at 5 (DON'T score with default WAF scheme).
    tournamentsRepo.findOne.mockResolvedValue(makeTournament());
    const players: Player[] = Array.from({ length: 8 }, (_, i) => ({
      id: `e${i + 1}`,
      firstName: 'P',
      lastName: `${i + 1}`,
      number: i + 1,
    }));
    let data = generateSingleElimination(players);
    data = selectWinner(data, 'wb_1_0', 'e1');
    data = selectWinner(data, 'wb_1_1', 'e3');
    data = selectWinner(data, 'wb_1_2', 'e5');
    data = selectWinner(data, 'wb_1_3', 'e7');
    data = selectWinner(data, 'wb_2_0', 'e1');
    data = selectWinner(data, 'wb_2_1', 'e5');
    data = selectWinner(data, 'wb_3_0', 'e1');
    bracketsRepo.find.mockResolvedValue([
      { id: 'b1', name: '8-bracket', bracketData: data },
    ]);
    // Only the top-4 entries are loaded — service filtered by points>0
    // before the join, so the QF losers never get queried.
    entriesRepo.find.mockResolvedValue([
      { id: 'e1', userId: 'u1', athleteCountry: 'AM' },
      { id: 'e5', userId: 'u5', athleteCountry: 'GE' },
      { id: 'e3', userId: 'u3', athleteCountry: 'AM' },
      { id: 'e7', userId: 'u7', athleteCountry: 'GE' },
    ]);

    const out = await service.getForTournament('tournament-1');

    const requestedIds = (entriesRepo.find.mock.calls[0]?.[0] as { where?: { id?: { _value?: string[] } } } | undefined)?.where?.id?._value;
    expect(requestedIds).toBeDefined();
    expect(new Set(requestedIds)).toEqual(new Set(['e1', 'e3', 'e5', 'e7']));
    expect(requestedIds).not.toContain('e2');

    // AM: gold (7) + 1×bronze (3) = 10. GE: silver (5) + 1×bronze (3) = 8.
    expect(out.rows[0]).toMatchObject({ team: 'AM', position: 1, points: 10 });
    expect(out.rows[1]).toMatchObject({ team: 'GE', position: 2, points: 8 });
  });

  it('skips placements whose entry has no athleteCountry', async () => {
    tournamentsRepo.findOne.mockResolvedValue(makeTournament());
    bracketsRepo.find.mockResolvedValue([
      buildFinishedBracket('b1', 'cat', {
        entryA: 'a',
        entryB: 'b',
        entryC: 'c',
        entryD: 'd',
      }),
    ]);
    entriesRepo.find.mockResolvedValue([
      { id: 'a', userId: 'ua', athleteCountry: 'AM' },
      { id: 'b', userId: 'ub', athleteCountry: null },
      { id: 'c', userId: 'uc', athleteCountry: 'AM' },
      { id: 'd', userId: 'ud', athleteCountry: null },
    ]);

    const out = await service.getForTournament('tournament-1');
    // Only AM is on the leaderboard; b/d's missing-country entries
    // simply don't contribute.
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0]).toMatchObject({ team: 'AM', points: 10 });
  });

  it('breaks ties by athletesScoring then alpha', async () => {
    tournamentsRepo.findOne.mockResolvedValue(makeTournament());
    // Two brackets so AM and BR can each rack up gold + silver from
    // 2 distinct athletes. Both end on (12 pts, 2 athletesScoring) →
    // alpha tiebreaker → AM ranks above BR. Tied at competition
    // ranking position 1.
    bracketsRepo.find.mockResolvedValue([
      buildFinishedBracket('b1', 'cat1', {
        entryA: 'am-1',
        entryB: 'br-1',
        entryC: 'x-1',
        entryD: 'y-1',
      }),
      buildFinishedBracket('b2', 'cat2', {
        entryA: 'br-2',
        entryB: 'am-2',
        entryC: 'x-2',
        entryD: 'y-2',
      }),
    ]);
    entriesRepo.find.mockResolvedValue([
      { id: 'am-1', userId: 'u-am1', athleteCountry: 'AM' },
      { id: 'br-1', userId: 'u-br1', athleteCountry: 'BR' },
      { id: 'x-1', userId: 'u-x1', athleteCountry: null },
      { id: 'y-1', userId: 'u-y1', athleteCountry: null },
      { id: 'br-2', userId: 'u-br2', athleteCountry: 'BR' },
      { id: 'am-2', userId: 'u-am2', athleteCountry: 'AM' },
      { id: 'x-2', userId: 'u-x2', athleteCountry: null },
      { id: 'y-2', userId: 'u-y2', athleteCountry: null },
    ]);

    const out = await service.getForTournament('tournament-1');
    expect(out.rows).toHaveLength(2);
    // Both score 7+5=12 with 2 athletesScoring each → alpha → AM first.
    expect(out.rows.map((r) => r.team)).toEqual(['AM', 'BR']);
    expect(out.rows[0]).toMatchObject({ position: 1, points: 12, athletesScoring: 2 });
    expect(out.rows[1]).toMatchObject({ position: 1, points: 12, athletesScoring: 2 });
  });

  it('honours a per-tournament teamScoring override', async () => {
    tournamentsRepo.findOne.mockResolvedValue(
      makeTournament({
        sportConfig: { teamScoring: { pointsByPlace: { 1: 10, 2: 8, 3: 6, 4: 4 } } },
      }),
    );
    bracketsRepo.find.mockResolvedValue([
      buildFinishedBracket('b1', 'cat', {
        entryA: 'a',
        entryB: 'b',
        entryC: 'c',
        entryD: 'd',
      }),
    ]);
    entriesRepo.find.mockResolvedValue([
      { id: 'a', userId: 'ua', athleteCountry: 'AM' },
      { id: 'b', userId: 'ub', athleteCountry: 'GE' },
      { id: 'c', userId: 'uc', athleteCountry: 'AM' },
      { id: 'd', userId: 'ud', athleteCountry: 'GE' },
    ]);

    const out = await service.getForTournament('tournament-1');
    expect(out.pointsByPlace).toEqual({ 1: 10, 2: 8, 3: 6, 4: 4 });
    // AM: 10 (gold) + 6 (bronze) = 16. GE: 8 (silver) + 6 (bronze) = 14.
    expect(out.rows[0]).toMatchObject({ team: 'AM', points: 16 });
    expect(out.rows[1]).toMatchObject({ team: 'GE', points: 14 });
  });
});
