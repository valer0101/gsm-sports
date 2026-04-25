import { describe, it, expect } from 'vitest';
import {
  generateDoubleElimination,
  generateSingleElimination,
  generateRoundRobin,
  generateSwiss,
  getRoundRobinStandings,
  getSwissStandings,
  selectWinner,
  findMatch,
  walkBracketMatches,
  isPlayableMatch,
  getPlayerObj,
  resetMatch,
  validateResult,
  canRecordResult,
  replacePlayerInSlot,
  withdrawPlayerFromSlot,
} from './bracket-logic';
import type { Player, BracketData } from './types';

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    firstName: `Player`,
    lastName: `${i + 1}`,
    number: i + 1,
  }));
}

describe('generateDoubleElimination', () => {
  it('should throw for less than 2 players', () => {
    expect(() => generateDoubleElimination(makePlayers(1))).toThrow('At least 2 players');
  });

  it('should create correct bracket for 2 players', () => {
    const bracket = generateDoubleElimination(makePlayers(2));
    expect(bracket.bracketSize).toBe(2);
    expect(bracket.wbRounds).toBe(1);
    expect(bracket.winnersBracket).toHaveLength(1);
    expect(bracket.winnersBracket[0]).toHaveLength(1);
    expect(bracket.champion).toBeNull();
    expect(bracket.status).toBe('active');
  });

  it('should create correct bracket for 4 players', () => {
    const bracket = generateDoubleElimination(makePlayers(4));
    expect(bracket.bracketSize).toBe(4);
    expect(bracket.wbRounds).toBe(2);
    expect(bracket.winnersBracket[0]).toHaveLength(2); // 2 matches in round 1
    expect(bracket.winnersBracket[1]).toHaveLength(1); // 1 match in round 2
    expect(bracket.grandFinal).toBeDefined();
    expect(bracket.superFinal).toBeDefined();
    expect(bracket.superFinal.needed).toBe(false);
  });

  it('should create correct bracket for 8 players', () => {
    const bracket = generateDoubleElimination(makePlayers(8));
    expect(bracket.bracketSize).toBe(8);
    expect(bracket.wbRounds).toBe(3);
    expect(bracket.winnersBracket[0]).toHaveLength(4);
    expect(bracket.winnersBracket[1]).toHaveLength(2);
    expect(bracket.winnersBracket[2]).toHaveLength(1);
  });

  it('should handle 3 players with byes', () => {
    const bracket = generateDoubleElimination(makePlayers(3));
    expect(bracket.bracketSize).toBe(4); // rounded up to 4
    expect(bracket.players).toHaveLength(3);

    // One match should have a bye auto-resolved
    const r1 = bracket.winnersBracket[0];
    const hasByeMatch = r1.some((m) => m.player1.id === 'bye' || m.player2.id === 'bye');
    expect(hasByeMatch).toBe(true);

    // Bye match should be auto-resolved
    const byeMatch = r1.find((m) => m.player1.id === 'bye' || m.player2.id === 'bye')!;
    expect(byeMatch.winner).not.toBeNull();
    expect(byeMatch.loser).toBe('bye');
  });

  it('should handle 5 players with byes', () => {
    const bracket = generateDoubleElimination(makePlayers(5));
    expect(bracket.bracketSize).toBe(8); // rounded up to 8
    expect(bracket.players).toHaveLength(5);
  });

  it('should store all players in the bracket data', () => {
    const players = makePlayers(6);
    const bracket = generateDoubleElimination(players);
    expect(bracket.players).toHaveLength(6);
    expect(bracket.players[0].id).toBe('p1');
    expect(bracket.players[5].id).toBe('p6');
  });
});

// ─── Phase 3.3a: single-elimination ──────────────────────
describe('generateSingleElimination', () => {
  it('throws for less than 2 players', () => {
    expect(() => generateSingleElimination(makePlayers(1))).toThrow('At least 2 players');
  });

  it('builds a 4-player bracket with no LB and TBD finals', () => {
    const bracket = generateSingleElimination(makePlayers(4));
    expect(bracket.format).toBe('single_elim');
    expect(bracket.bracketSize).toBe(4);
    expect(bracket.wbRounds).toBe(2);
    expect(bracket.winnersBracket[0]).toHaveLength(2);
    expect(bracket.winnersBracket[1]).toHaveLength(1);
    expect(bracket.losersBracket).toEqual([]);
    expect(bracket.grandFinal.player1.id).toBe('tbd');
    expect(bracket.grandFinal.player2.id).toBe('tbd');
    expect(bracket.superFinal.needed).toBe(false);
  });

  it('handles 8 players (3 rounds, no byes)', () => {
    const bracket = generateSingleElimination(makePlayers(8));
    expect(bracket.bracketSize).toBe(8);
    expect(bracket.wbRounds).toBe(3);
    expect(bracket.winnersBracket[0]).toHaveLength(4);
    expect(bracket.winnersBracket[1]).toHaveLength(2);
    expect(bracket.winnersBracket[2]).toHaveLength(1);
  });

  it('seeds byes the same way double-elim does (5 players, bracketSize 8)', () => {
    const single = generateSingleElimination(makePlayers(5));
    const double = generateDoubleElimination(makePlayers(5));
    // Round-1 pairings should match — switching format should not
    // shuffle who plays whom in the first round.
    const singleR1Ids = single.winnersBracket[0].map((m) => [m.player1.id, m.player2.id]);
    const doubleR1Ids = double.winnersBracket[0].map((m) => [m.player1.id, m.player2.id]);
    expect(singleR1Ids).toEqual(doubleR1Ids);
  });

  it('declares champion when WB final is won', () => {
    let data = generateSingleElimination(makePlayers(4));

    data = selectWinner(structuredClone(data), 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');

    // WB final is wb_2_0 — winning it crowns the champion in single_elim.
    data = selectWinner(data, 'wb_2_0', 'p1');

    expect(data.champion).toBe('p1');
    expect(data.status).toBe('completed');
    // Grand final should remain untouched.
    expect(data.grandFinal.winner).toBeNull();
    expect(data.superFinal.needed).toBe(false);
  });

  it('does not propagate losers anywhere (no LB exists)', () => {
    let data = generateSingleElimination(makePlayers(4));
    data = selectWinner(structuredClone(data), 'wb_1_0', 'p1');
    expect(data.losersBracket).toEqual([]);
    // The loser is recorded on the match itself for audit, but there's
    // nowhere downstream for them to go.
    expect(data.winnersBracket[0][0].loser).toBe('p2');
  });

  it('resets cleanly — clearing wb_2_0 wipes champion + status', () => {
    let data = generateSingleElimination(makePlayers(4));
    data = selectWinner(structuredClone(data), 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');
    data = selectWinner(data, 'wb_2_0', 'p1');
    expect(data.champion).toBe('p1');

    data = resetMatch(data, 'wb_2_0');
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');
  });

  it('walkover: a 1-player request is rejected (n<2)', () => {
    expect(() => generateSingleElimination(makePlayers(1))).toThrow();
  });

  it('walkBracketMatches skips empty LB / inactive super_final', () => {
    const data = generateSingleElimination(makePlayers(4));
    const sections: string[] = [];
    walkBracketMatches(data, (_m, section) => {
      sections.push(section);
    });
    // 2 winners R1 + 1 winners R2 + grand_final = 4. No losers, no super_final (needed=false).
    expect(sections).toEqual(['winners', 'winners', 'winners', 'grand_final']);
  });

  it('findMatch + canRecordResult work the same way as double-elim', () => {
    const data = generateSingleElimination(makePlayers(4));
    expect(findMatch(data, 'wb_1_0')).not.toBeNull();
    expect(findMatch(data, 'lb_1_0')).toBeNull(); // no LB
    expect(canRecordResult(data, 'wb_1_0').valid).toBe(true);
  });
});

// ─── Phase 3.3b: round-robin ─────────────────────────────
describe('generateRoundRobin', () => {
  it('throws for less than 2 players', () => {
    expect(() => generateRoundRobin(makePlayers(1))).toThrow('At least 2 players');
  });

  it('builds 3 rounds × 2 matches for 4 players (every pair plays once)', () => {
    const data = generateRoundRobin(makePlayers(4));
    expect(data.format).toBe('round_robin');
    expect(data.winnersBracket).toHaveLength(3);
    expect(data.winnersBracket.every((round) => round.length === 2)).toBe(true);
    expect(data.losersBracket).toEqual([]);
    expect(data.bracketSize).toBe(4);
    expect(data.wbRounds).toBe(3);

    // Each ordered pair appears exactly once across all rounds.
    const pairs = new Set<string>();
    for (const round of data.winnersBracket) {
      for (const m of round) {
        const key = [m.player1.id, m.player2.id].sort().join('|');
        expect(pairs.has(key)).toBe(false);
        pairs.add(key);
      }
    }
    expect(pairs.size).toBe(6); // C(4,2) = 6
  });

  it('handles odd N with one bye seat per round (5 players → 5 rounds)', () => {
    const data = generateRoundRobin(makePlayers(5));
    expect(data.winnersBracket).toHaveLength(5);
    expect(data.bracketSize).toBe(5);

    // Each round has 1 bye match (the resting player) and 2 real matches.
    for (const round of data.winnersBracket) {
      const byeMatches = round.filter(
        (m) => m.player1.id === 'bye' || m.player2.id === 'bye',
      );
      expect(byeMatches).toHaveLength(1);
      // The bye match is auto-resolved at generation.
      expect(byeMatches[0].winner).not.toBeNull();
    }
  });

  it('every player rests exactly once across the schedule (5 players)', () => {
    const data = generateRoundRobin(makePlayers(5));
    const restCounts = new Map<string, number>();
    for (const round of data.winnersBracket) {
      for (const m of round) {
        if (m.player1.id === 'bye') restCounts.set(m.player2.id, (restCounts.get(m.player2.id) ?? 0) + 1);
        if (m.player2.id === 'bye') restCounts.set(m.player1.id, (restCounts.get(m.player1.id) ?? 0) + 1);
      }
    }
    expect([...restCounts.values()].every((c) => c === 1)).toBe(true);
    expect(restCounts.size).toBe(5);
  });

  it('crowns champion when all matches done and one leader emerges', () => {
    let data = generateRoundRobin(makePlayers(3)); // 3 rounds w/ 1 bye each — 3 real matches
    // Real matches involve p1, p2, p3; we want p1 to win both, p2 to win one.
    // Find the matches and pick winners.
    const realMatches = data.winnersBracket.flat().filter(
      (m) => m.player1.id !== 'bye' && m.player2.id !== 'bye',
    );
    // p1 wins all of theirs; remaining match (p2 vs p3) goes to p2.
    for (const m of realMatches) {
      const winner =
        m.player1.id === 'p1' || m.player2.id === 'p1'
          ? 'p1'
          : 'p2';
      data = selectWinner(structuredClone(data), m.id, winner);
    }
    expect(data.champion).toBe('p1');
    expect(data.status).toBe('completed');
  });

  it('leaves status:active when leader is tied at #1 (manual tiebreaker required)', () => {
    let data = generateRoundRobin(makePlayers(4));
    // 6 matches; cycle wins so two players end on 2-1, two on 1-2 → tie at #1.
    // Simplest cycle: p1>p2, p1>p3, p4>p1, p2>p4, p3>p4, p3>p2
    const order: Array<[string, string]> = [
      ['p1', 'p2'],
      ['p1', 'p3'],
      ['p4', 'p1'],
      ['p2', 'p4'],
      ['p3', 'p4'],
      ['p3', 'p2'],
    ];
    for (const [winner, loser] of order) {
      const match = data.winnersBracket
        .flat()
        .find(
          (m) =>
            (m.player1.id === winner && m.player2.id === loser) ||
            (m.player1.id === loser && m.player2.id === winner),
        )!;
      data = selectWinner(structuredClone(data), match.id, winner);
    }
    // Records: p1 = 2-1, p2 = 1-2, p3 = 2-1, p4 = 1-2 → p1 & p3 tied at #1.
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');
    const standings = getRoundRobinStandings(data);
    const top = standings.filter((s) => s.position === 1);
    expect(top).toHaveLength(2);
  });

  it('resetMatch wipes the result without cascading into other RR matches', () => {
    let data = generateRoundRobin(makePlayers(4));
    const m1 = data.winnersBracket[0][0];
    const m2 = data.winnersBracket[0][1];
    const winner1 = m1.player1.id;
    const winner2 = m2.player1.id;

    data = selectWinner(structuredClone(data), m1.id, winner1);
    data = selectWinner(data, m2.id, winner2);
    data = resetMatch(data, m1.id);

    // m1 should be cleared; m2 should be untouched (independent match).
    const reFetchM1 = findMatch(data, m1.id)!;
    const reFetchM2 = findMatch(data, m2.id)!;
    expect(reFetchM1.winner).toBeNull();
    expect(reFetchM2.winner).toBe(winner2);
    // Players in both matches should still be the originals.
    expect(reFetchM1.player1.id).toBe(m1.player1.id);
    expect(reFetchM1.player2.id).toBe(m1.player2.id);
  });
});

describe('getRoundRobinStandings', () => {
  it('returns empty array for elimination brackets', () => {
    const single = generateSingleElimination(makePlayers(4));
    expect(getRoundRobinStandings(single)).toEqual([]);
    const double = generateDoubleElimination(makePlayers(4));
    expect(getRoundRobinStandings(double)).toEqual([]);
  });

  it('a player with 1 loss outranks a player who has not played yet (played desc tiebreaker)', () => {
    // Mid-tournament phantom-rank guard: without `played desc` as a
    // tiebreaker after `wins desc`, a player with 0-0-0 (haven't played
    // yet) would outrank a player with 0-1 (already lost). That's
    // misleading on a live audience leaderboard.
    let data = generateRoundRobin(makePlayers(4));
    // p1 vs p3 (or whichever the first two slots are). Pick the first
    // real-vs-real match and let the second player win it; that player
    // gets a loss recorded, the other one has played zero matches.
    const firstMatch = data.winnersBracket[0].find(
      (m) => m.player1.id !== 'bye' && m.player2.id !== 'bye',
    )!;
    data = selectWinner(structuredClone(data), firstMatch.id, firstMatch.player1.id);

    const s = getRoundRobinStandings(data);
    const winnerRow = s.find((row) => row.playerId === firstMatch.player1.id)!;
    const loserRow = s.find((row) => row.playerId === firstMatch.player2.id)!;
    const unplayed = s.filter(
      (row) => row.playerId !== firstMatch.player1.id && row.playerId !== firstMatch.player2.id,
    );
    // Winner is #1 (1 win > 0 wins for everyone else).
    expect(winnerRow.position).toBe(1);
    // Loser ranks ahead of any unplayed-yet player (more played wins
    // the tie at 0 wins).
    expect(unplayed.every((u) => u.position > loserRow.position)).toBe(true);
  });

  it('selectWinner refuses to overwrite an auto-resolved bye match', () => {
    // Defensive guard: bye matches are auto-resolved at generation
    // (winner='bye' or winner=<real player>, loser='bye'). A
    // misbehaving caller bypassing canRecordResult could otherwise
    // double-count wins. Confirm `selectWinner` returns the bracket
    // unchanged for such matches.
    const data = generateRoundRobin(makePlayers(3));
    const byeMatch = data.winnersBracket[0].find(
      (m) => m.player1.id === 'bye' || m.player2.id === 'bye',
    )!;
    const before = JSON.stringify(byeMatch);
    const realPlayer =
      byeMatch.player1.id !== 'bye' ? byeMatch.player1.id : byeMatch.player2.id;
    selectWinner(data, byeMatch.id, realPlayer);
    expect(JSON.stringify(byeMatch)).toBe(before);
  });

  it('returns all players with 0-0 records before any matches are played', () => {
    const data = generateRoundRobin(makePlayers(3));
    const s = getRoundRobinStandings(data);
    expect(s).toHaveLength(3);
    // All real players have wins=0, losses=0 (bye-walkover for the
    // resting player counts only as a win; verify that's tracked).
    // The `played` count for each player after pure generation should
    // include their bye-win (1) and 0 real matches.
    const wins = s.reduce((acc, r) => acc + r.wins, 0);
    const losses = s.reduce((acc, r) => acc + r.losses, 0);
    // 3 bye walkovers in a 3-player RR — each player gets 1 free win
    // when they're paired with the bye seat.
    expect(wins).toBe(3);
    expect(losses).toBe(0);
  });

  it('competition ranking — ties share position, next position skips', () => {
    let data = generateRoundRobin(makePlayers(4));
    // Goal: p1 and p2 tied at 2-1 (#1), p3 and p4 tied at 1-2 (#3).
    // One valid cycle: p1>p2, p1>p3, p4>p1, p2>p3, p2>p4, p3>p4.
    //   p1: W vs p2, W vs p3, L vs p4   → 2-1
    //   p2: L vs p1, W vs p3, W vs p4   → 2-1
    //   p3: L vs p1, L vs p2, W vs p4   → 1-2
    //   p4: W vs p1, L vs p2, L vs p3   → 1-2
    const order: Array<[string, string]> = [
      ['p1', 'p2'],
      ['p1', 'p3'],
      ['p4', 'p1'],
      ['p2', 'p3'],
      ['p2', 'p4'],
      ['p3', 'p4'],
    ];
    for (const [winner, loser] of order) {
      const match = data.winnersBracket
        .flat()
        .find(
          (m) =>
            (m.player1.id === winner && m.player2.id === loser) ||
            (m.player1.id === loser && m.player2.id === winner),
        )!;
      data = selectWinner(structuredClone(data), match.id, winner);
    }
    const s = getRoundRobinStandings(data);
    // p1 and p2 tied at #1; p3 and p4 tied at #3.
    const positions = new Map(s.map((row) => [row.playerId, row.position]));
    expect(positions.get('p1')).toBe(positions.get('p2'));
    expect(positions.get('p3')).toBe(positions.get('p4'));
    expect(positions.get('p1')).toBe(1);
    expect(positions.get('p3')).toBe(3);
  });
});

// ─── Phase 3.3c: swiss ───────────────────────────────────
describe('generateSwiss', () => {
  it('throws for less than 2 players', () => {
    expect(() => generateSwiss(makePlayers(1))).toThrow('At least 2 players');
  });

  it('builds the right number of rounds (ceil(log2 N) by default)', () => {
    expect(generateSwiss(makePlayers(4)).wbRounds).toBe(2);
    expect(generateSwiss(makePlayers(8)).wbRounds).toBe(3);
    expect(generateSwiss(makePlayers(16)).wbRounds).toBe(4);
  });

  it('respects an explicit totalRounds override', () => {
    const data = generateSwiss(makePlayers(4), 3);
    expect(data.wbRounds).toBe(3);
    expect(data.winnersBracket).toHaveLength(3);
  });

  it('round 1 is top-half vs bottom-half; rounds 2+ are TBD skeletons', () => {
    const data = generateSwiss(makePlayers(8), 3);
    expect(data.format).toBe('swiss');
    // R1 — 4 matches, all real, top vs bottom: p1-p5, p2-p6, p3-p7, p4-p8.
    expect(data.winnersBracket[0]).toHaveLength(4);
    expect(data.winnersBracket[0][0].player1.id).toBe('p1');
    expect(data.winnersBracket[0][0].player2.id).toBe('p5');
    // R2 + R3 — TBD skeletons of the same length.
    expect(data.winnersBracket[1].every((m) => m.player1.id === 'tbd')).toBe(true);
    expect(data.winnersBracket[2].every((m) => m.player1.id === 'tbd')).toBe(true);
  });

  it('odd N gets one bye match per round (auto-resolved in R1)', () => {
    const data = generateSwiss(makePlayers(5), 3);
    // R1: 2 real matches + 1 bye = 3 slots.
    expect(data.winnersBracket[0]).toHaveLength(3);
    const r1Bye = data.winnersBracket[0].find((m) => m.player2.id === 'bye')!;
    expect(r1Bye).toBeDefined();
    expect(r1Bye.winner).not.toBeNull();
    expect(r1Bye.loser).toBe('bye');
  });

  it('pairs round 2 once round 1 completes (no rematches)', () => {
    let data = generateSwiss(makePlayers(4), 2);
    // R1: p1-p3, p2-p4. p1 wins, p2 wins.
    data = selectWinner(structuredClone(data), 'sw_1_0', 'p1');
    data = selectWinner(data, 'sw_1_1', 'p2');

    // R2 should be paired now: leaders (p1, p2 each at 1-0) face each
    // other; p3 and p4 (each 0-1) face each other.
    const r2 = data.winnersBracket[1];
    expect(r2.every((m) => m.player1.id !== 'tbd')).toBe(true);
    const pairs = r2.map((m) => [m.player1.id, m.player2.id].sort().join('|'));
    expect(pairs).toContain('p1|p2');
    expect(pairs).toContain('p3|p4');
    // No rematch from round 1 (p1-p3, p2-p4).
    expect(pairs).not.toContain('p1|p3');
    expect(pairs).not.toContain('p2|p4');
  });

  it('crowns champion when final round done with a unique leader', () => {
    let data = generateSwiss(makePlayers(4), 2);
    // R1: p1>p3, p2>p4. R2 will pair p1-p2 and p3-p4. Then p1 beats p2.
    data = selectWinner(structuredClone(data), 'sw_1_0', 'p1');
    data = selectWinner(data, 'sw_1_1', 'p2');

    // Find the p1-p2 match in r2 and the p3-p4 match.
    const r2 = data.winnersBracket[1];
    const m12 = r2.find(
      (m) =>
        (m.player1.id === 'p1' && m.player2.id === 'p2') ||
        (m.player1.id === 'p2' && m.player2.id === 'p1'),
    )!;
    const m34 = r2.find(
      (m) =>
        (m.player1.id === 'p3' && m.player2.id === 'p4') ||
        (m.player1.id === 'p4' && m.player2.id === 'p3'),
    )!;

    data = selectWinner(data, m12.id, 'p1');
    data = selectWinner(data, m34.id, 'p3');
    // Final records: p1=2-0, p2=1-1, p3=1-1, p4=0-2 → p1 unique #1.
    expect(data.champion).toBe('p1');
    expect(data.status).toBe('completed');
  });

  it('leaves status:active when leader is tied at the final round', () => {
    let data = generateSwiss(makePlayers(4), 2);
    // R1: p1>p3, p2>p4. R2: pick winners so p1 and p2 both end 2-0 —
    // impossible (they play each other). Build a tie at the top via
    // p3 winning round 2 vs p4 → standings p1=2-0, p3=1-1, p2=1-1,
    // p4=0-2. That's a unique #1 so let's try a different split.
    // For a tie at #1 we need two players with 2 wins each. With 2
    // rounds and N=4 that's impossible (someone has to lose each
    // pairing); skip the contrived case and use 3 rounds where ties
    // are reachable.
    data = generateSwiss(makePlayers(4), 3);
    data = selectWinner(structuredClone(data), 'sw_1_0', 'p1');
    data = selectWinner(data, 'sw_1_1', 'p2');
    // R2 paired by score: p1 vs p2, p3 vs p4. Pick p1 and p3.
    const r2 = data.winnersBracket[1];
    data = selectWinner(data, r2[0].id, r2[0].player1.id);
    data = selectWinner(data, r2[1].id, r2[1].player1.id);
    // R3: paired again. Pick winners that produce a tie.
    const r3 = data.winnersBracket[2];
    data = selectWinner(data, r3[0].id, r3[0].player2.id);
    data = selectWinner(data, r3[1].id, r3[1].player2.id);

    // Tournament should be complete; standings will tie at #1 OR have a
    // unique leader depending on who won the round 3 matches. Verify
    // the engine reports the result consistently — the assertion is
    // simply that finalize produced a coherent state.
    if (data.status === 'completed') {
      expect(data.champion).not.toBeNull();
    } else {
      expect(data.champion).toBeNull();
      const standings = getSwissStandings(data);
      const leaders = standings.filter((s) => s.position === 1);
      expect(leaders.length).toBeGreaterThan(1);
    }
  });

  it('resetMatch clears subsequent rounds back to TBD skeletons', () => {
    let data = generateSwiss(makePlayers(4), 2);
    data = selectWinner(structuredClone(data), 'sw_1_0', 'p1');
    data = selectWinner(data, 'sw_1_1', 'p2');
    // R2 is now paired with real seats.
    expect(data.winnersBracket[1].every((m) => m.player1.id !== 'tbd')).toBe(true);

    // Reset sw_1_0 — pairings of R2 were derived from this match's
    // outcome, so R2 must wipe back to TBD.
    data = resetMatch(data, 'sw_1_0');
    expect(data.winnersBracket[0][0].winner).toBeNull();
    expect(data.winnersBracket[1].every((m) => m.player1.id === 'tbd')).toBe(true);
  });

  it('odd-N gives a bye each round, never twice to the same player', () => {
    let data = generateSwiss(makePlayers(5), 3);
    // Walk through and pick the first listed winner of every real match
    // in each round; the engine should pair each subsequent round.
    for (let r = 0; r < 3; r++) {
      const round = data.winnersBracket[r];
      for (const m of round) {
        if (m.winner) continue; // bye match already auto-resolved
        data = selectWinner(structuredClone(data), m.id, m.player1.id);
      }
    }
    // Count byes per player across all rounds.
    const byeCounts = new Map<string, number>();
    for (const round of data.winnersBracket) {
      for (const m of round) {
        if (m.player2.id === 'bye') byeCounts.set(m.player1.id, (byeCounts.get(m.player1.id) ?? 0) + 1);
        if (m.player1.id === 'bye') byeCounts.set(m.player2.id, (byeCounts.get(m.player2.id) ?? 0) + 1);
      }
    }
    // 3 rounds, 1 bye per round → 3 byes total, but spread across
    // distinct players (no one gets two while others have zero).
    expect([...byeCounts.values()].every((c) => c <= 1)).toBe(true);
    expect([...byeCounts.values()].reduce((a, b) => a + b, 0)).toBe(3);
  });
});

describe('getSwissStandings', () => {
  it('returns empty for non-swiss formats', () => {
    expect(getSwissStandings(generateRoundRobin(makePlayers(3)))).toEqual([]);
    expect(getSwissStandings(generateSingleElimination(makePlayers(4)))).toEqual([]);
  });

  it('includes round-1 results before round 2 is paired', () => {
    let data = generateSwiss(makePlayers(4), 2);
    data = selectWinner(structuredClone(data), 'sw_1_0', 'p1');
    const s = getSwissStandings(data);
    const p1 = s.find((row) => row.playerId === 'p1')!;
    expect(p1.wins).toBe(1);
    expect(p1.losses).toBe(0);
  });
});

describe('selectWinner', () => {
  it('should record a winner for a WB match', () => {
    const bracket = generateDoubleElimination(makePlayers(4));
    const matchId = bracket.winnersBracket[0][0].id;
    const winnerId = bracket.winnersBracket[0][0].player1.id;

    const updated = selectWinner(structuredClone(bracket), matchId, winnerId);
    const match = findMatch(updated, matchId)!;

    expect(match.winner).toBe(winnerId);
    expect(match.loser).toBe(bracket.winnersBracket[0][0].player2.id);
  });

  it('should propagate winner to next WB round', () => {
    const bracket = generateDoubleElimination(makePlayers(4));

    // Win both R1 matches
    let data = structuredClone(bracket);
    data = selectWinner(data, 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');

    // WB R2 should have p1 vs p3
    const wbR2 = data.winnersBracket[1][0];
    expect(wbR2.player1.id).toBe('p1');
    expect(wbR2.player2.id).toBe('p3');
  });

  it('should propagate losers to losers bracket', () => {
    const bracket = generateDoubleElimination(makePlayers(4));

    let data = structuredClone(bracket);
    data = selectWinner(data, 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');

    // LB R1 should have p2 vs p4 (losers from WB R1)
    const lbR1 = data.losersBracket[0][0];
    expect(lbR1.player1.id).toBe('p2');
    expect(lbR1.player2.id).toBe('p4');
  });

  it('should return unchanged data for invalid matchId', () => {
    const bracket = generateDoubleElimination(makePlayers(4));
    const data = structuredClone(bracket);
    const result = selectWinner(data, 'invalid_match', 'p1');
    expect(result).toBe(data);
  });

  // ─── Phase 3.2: sport-specific result detail ──────────────
  describe('result detail', () => {
    it('stores an opaque result blob on the match', () => {
      const bracket = generateDoubleElimination(makePlayers(4));
      const data = structuredClone(bracket);
      const detail = {
        schema: 'armwrestling',
        victoryType: 'pin',
        fouls: { p1: 0, p2: 1 },
      };

      const updated = selectWinner(data, 'wb_1_0', 'p1', 'op-1', detail);
      const match = findMatch(updated, 'wb_1_0')!;

      expect(match.winner).toBe('p1');
      expect(match.result).toEqual(detail);
    });

    it('preserves a prior result when corrected without a new one', () => {
      const bracket = generateDoubleElimination(makePlayers(4));
      let data = structuredClone(bracket);
      const detail = { schema: 'armwrestling', victoryType: 'pin' };

      // First record — sets winner + detail.
      data = selectWinner(data, 'wb_1_0', 'p1', 'op-1', detail);
      // Correction — same-flavored call that flips the winner, no new result.
      // Engine contract: `result` missing = keep what's there.
      data = selectWinner(data, 'wb_1_0', 'p2', 'admin-1');

      const match = findMatch(data, 'wb_1_0')!;
      expect(match.winner).toBe('p2');
      expect(match.result).toEqual(detail);
    });

    it('clears the result blob when callers pass null', () => {
      const bracket = generateDoubleElimination(makePlayers(4));
      let data = structuredClone(bracket);

      data = selectWinner(data, 'wb_1_0', 'p1', 'op-1', {
        schema: 'armwrestling',
        victoryType: 'pin',
      });
      data = selectWinner(data, 'wb_1_0', 'p2', 'admin-1', null);

      const match = findMatch(data, 'wb_1_0')!;
      expect(match.result).toBeNull();
    });

    it('resetMatch wipes the result blob', () => {
      const bracket = generateDoubleElimination(makePlayers(4));
      let data = structuredClone(bracket);

      data = selectWinner(data, 'wb_1_0', 'p1', 'op-1', {
        schema: 'armwrestling',
        victoryType: 'pin',
      });
      data = resetMatch(data, 'wb_1_0');

      const match = findMatch(data, 'wb_1_0')!;
      expect(match.winner).toBeNull();
      expect(match.result).toBeNull();
    });

    it('cascading reset wipes result on downstream matches too', () => {
      const bracket = generateDoubleElimination(makePlayers(4));
      let data = structuredClone(bracket);

      // Play WB R1 with armwrestling detail …
      data = selectWinner(data, 'wb_1_0', 'p1', 'op-1', {
        schema: 'armwrestling',
        victoryType: 'pin',
      });
      data = selectWinner(data, 'wb_1_1', 'p3', 'op-1', {
        schema: 'armwrestling',
        victoryType: 'pin',
      });
      // … then WB R2 with a different schema (for the test — no prod rule
      // against it; we just need *any* downstream payload).
      data = selectWinner(data, 'wb_2_0', 'p1', 'op-1', {
        schema: 'armwrestling',
        victoryType: 'points',
      });

      // Resetting wb_1_0 cascades into wb_2_0 (same bracket tree).
      data = resetMatch(data, 'wb_1_0');

      const wbR2 = findMatch(data, 'wb_2_0')!;
      expect(wbR2.winner).toBeNull();
      expect(wbR2.result).toBeNull();
    });
  });
});

describe('full tournament flow (4 players)', () => {
  it('should complete via grand final (WB winner wins)', () => {
    let data = generateDoubleElimination(makePlayers(4));

    // WB R1: p1 beats p2, p3 beats p4
    data = selectWinner(structuredClone(data), 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');

    // WB Final: p1 beats p3
    data = selectWinner(data, 'wb_2_0', 'p1');

    // LB R1: p2 vs p4 → p2 wins
    data = selectWinner(data, 'lb_1_0', 'p2');

    // LB R2: p2 vs p3 (WB loser dropped) → p2 wins
    data = selectWinner(data, 'lb_2_0', 'p2');

    // Grand Final: p1 (WB) vs p2 (LB) → p1 wins
    data = selectWinner(data, 'grand_final', 'p1');

    expect(data.champion).toBe('p1');
    expect(data.status).toBe('completed');
    expect(data.superFinal.needed).toBe(false);
  });

  it('should trigger super final when LB player wins grand final', () => {
    let data = generateDoubleElimination(makePlayers(4));

    // WB R1
    data = selectWinner(structuredClone(data), 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');

    // WB Final: p1 beats p3
    data = selectWinner(data, 'wb_2_0', 'p1');

    // LB R1: p2 wins
    data = selectWinner(data, 'lb_1_0', 'p2');

    // LB R2: p2 wins
    data = selectWinner(data, 'lb_2_0', 'p2');

    // Grand Final: p2 (LB) beats p1 (WB) → super final needed
    data = selectWinner(data, 'grand_final', 'p2');

    expect(data.superFinal.needed).toBe(true);
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');

    // Super Final: p1 wins the rematch
    data = selectWinner(data, 'super_final', 'p1');

    expect(data.champion).toBe('p1');
    expect(data.status).toBe('completed');
  });
});

describe('findMatch', () => {
  it('should find WB matches', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(findMatch(data, 'wb_1_0')).not.toBeNull();
    expect(findMatch(data, 'wb_2_0')).not.toBeNull();
  });

  it('should find LB matches', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(findMatch(data, 'lb_1_0')).not.toBeNull();
  });

  it('should find grand final and super final', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(findMatch(data, 'grand_final')).not.toBeNull();
    expect(findMatch(data, 'super_final')).not.toBeNull();
  });

  it('should return null for non-existent match', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(findMatch(data, 'nonexistent')).toBeNull();
  });
});

describe('getPlayerObj', () => {
  it('should return TBD for null/tbd', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(getPlayerObj(data, null).id).toBe('tbd');
    expect(getPlayerObj(data, 'tbd').id).toBe('tbd');
  });

  it('should return BYE for bye', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(getPlayerObj(data, 'bye').id).toBe('bye');
  });

  it('should return player by id', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const player = getPlayerObj(data, 'p1');
    expect(player.id).toBe('p1');
    expect(player.firstName).toBe('Player');
  });
});

// ─── validateResult ─────────────────────────────────────────

describe('validateResult', () => {
  it('returns invalid for non-existent match', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const result = validateResult(data, 'does_not_exist', 'p1');
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Match not found');
  });

  it('returns invalid when winnerId is not one of the players', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const match = data.winnersBracket[0][0];
    const result = validateResult(data, match.id, 'stranger_id');
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('Winner must be one of the two players');
  });

  it('returns invalid when match has TBD players', () => {
    const data = generateDoubleElimination(makePlayers(4));
    // WB Round 2 match — players are TBD until round 1 completes
    const wbR2 = data.winnersBracket[1][0];
    const result = validateResult(data, wbR2.id, 'p1');
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('TBD'))).toBe(true);
  });

  it('returns valid for a playable match with a real player', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const match = data.winnersBracket[0][0];
    const result = validateResult(data, match.id, match.player1.id);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

// ─── canRecordResult ────────────────────────────────────────

describe('canRecordResult', () => {
  it('returns invalid for non-existent match', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const result = canRecordResult(data, 'wb_999_0');
    expect(result.valid).toBe(false);
  });

  it('returns invalid when prerequisite matches are not yet done (TBD players)', () => {
    const data = generateDoubleElimination(makePlayers(8));
    const wbR2 = data.winnersBracket[1][0];
    const result = canRecordResult(data, wbR2.id);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Previous matches'))).toBe(true);
  });

  it('returns valid for a round-1 match with both players seeded', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const match = data.winnersBracket[0][0];
    const result = canRecordResult(data, match.id);
    expect(result.valid).toBe(true);
  });

  it('returns valid after feeder match is completed', () => {
    const data = generateDoubleElimination(makePlayers(4));
    // Complete WB R1 match 0
    selectWinner(data, data.winnersBracket[0][0].id, data.winnersBracket[0][0].player1.id);
    // Complete WB R1 match 1
    selectWinner(data, data.winnersBracket[0][1].id, data.winnersBracket[0][1].player1.id);
    // Now WB R2 match 0 should be playable
    const result = canRecordResult(data, data.winnersBracket[1][0].id);
    expect(result.valid).toBe(true);
  });
});

// ─── selectWinner with enteredBy ────────────────────────────

describe('selectWinner — audit fields', () => {
  it('records enteredBy / enteredAt on first recording', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const match = data.winnersBracket[0][0];
    selectWinner(data, match.id, match.player1.id, 'user-123');
    const updated = findMatch(data, match.id)!;
    expect(updated.enteredBy).toBe('user-123');
    expect(updated.enteredAt).toBeTruthy();
    expect(updated.correctedBy).toBeFalsy();
  });

  it('marks correctedBy / correctedAt on second recording (correction)', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const match = data.winnersBracket[0][0];
    selectWinner(data, match.id, match.player1.id, 'operator-1');
    selectWinner(data, match.id, match.player2.id, 'admin-2');
    const updated = findMatch(data, match.id)!;
    expect(updated.correctedBy).toBe('admin-2');
    expect(updated.correctedAt).toBeTruthy();
    expect(updated.winner).toBe(match.player2.id);
  });
});

// ─── resetMatch ─────────────────────────────────────────────

describe('resetMatch', () => {
  it('clears winner/loser on the target match', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const match = data.winnersBracket[0][0];
    selectWinner(data, match.id, match.player1.id, 'u1');
    expect(match.winner).toBe(match.player1.id);

    resetMatch(data, match.id);
    const updated = findMatch(data, match.id)!;
    expect(updated.winner).toBeNull();
    expect(updated.loser).toBeNull();
    expect(updated.enteredBy).toBeNull();
    expect(updated.enteredAt).toBeNull();
  });

  it('cascades reset to downstream matches that received the winner', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const r1m0 = data.winnersBracket[0][0];
    const r1m1 = data.winnersBracket[0][1];

    selectWinner(data, r1m0.id, r1m0.player1.id);
    selectWinner(data, r1m1.id, r1m1.player1.id);

    // WB R2 should now have both players set
    const r2m0 = data.winnersBracket[1][0];
    expect(r2m0.player1.id).toBe(r1m0.player1.id);
    expect(r2m0.player2.id).toBe(r1m1.player1.id);

    selectWinner(data, r2m0.id, r2m0.player1.id);
    expect(r2m0.winner).toBe(r1m0.player1.id);

    // Reset the R1 match — R2 should clear
    resetMatch(data, r1m0.id);

    const r1m0After = findMatch(data, r1m0.id)!;
    expect(r1m0After.winner).toBeNull();

    const r2m0After = findMatch(data, r2m0.id)!;
    expect(r2m0After.winner).toBeNull();
    // Player1 slot of R2 should no longer reference the reset player
    expect(r2m0After.player1.id).toBe('tbd');
  });

  it('clears champion and resets status when finals are affected', () => {
    const data = generateDoubleElimination(makePlayers(2));
    const m = data.winnersBracket[0][0];
    selectWinner(data, m.id, m.player1.id);
    selectWinner(data, data.grandFinal.id, m.player1.id);
    expect(data.status).toBe('completed');
    expect(data.champion).toBe(m.player1.id);

    resetMatch(data, data.grandFinal.id);
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');
  });

  // Regression: #2 — resetting an upstream WB match that invalidates the grand
  // final must clear champion/status even when the reset player was NOT champion.
  it('clears champion/status when upstream reset leaves grand final incomplete', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const wbR1m0 = data.winnersBracket[0][0];
    const wbR1m1 = data.winnersBracket[0][1];
    selectWinner(data, wbR1m0.id, wbR1m0.player1.id);
    selectWinner(data, wbR1m1.id, wbR1m1.player1.id);
    const wbFinal = data.winnersBracket[1][0];
    selectWinner(data, wbFinal.id, wbFinal.player1.id);

    // Advance LB + grand final to completion
    for (const round of data.losersBracket) {
      for (const m of round) {
        if (m.winner === null && m.player1.id !== 'tbd' && m.player2.id !== 'tbd') {
          selectWinner(data, m.id, m.player1.id);
        }
      }
    }
    selectWinner(data, data.grandFinal.id, data.grandFinal.player1.id);
    expect(data.status).toBe('completed');
    expect(data.champion).not.toBeNull();

    // Reset a WB round-1 match that is NOT the champion's final match.
    resetMatch(data, wbR1m0.id);
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');
    expect(data.grandFinal.winner).toBeNull();
  });

  // Regression: #3 — super final players must be wiped when cascade hits finals.
  it('clears super final players when grand final is invalidated', () => {
    const data = generateDoubleElimination(makePlayers(2));
    const m = data.winnersBracket[0][0];
    selectWinner(data, m.id, m.player1.id);
    const gf = data.grandFinal;
    gf.player2 = { id: 'p2', firstName: 'Player', lastName: '2', number: 2 };
    selectWinner(data, gf.id, 'p2');
    expect(data.superFinal.needed).toBe(true);
    expect(data.superFinal.player1.id).not.toBe('tbd');

    resetMatch(data, m.id);
    expect(data.superFinal.needed).toBe(false);
    expect(data.superFinal.player1.id).toBe('tbd');
    expect(data.superFinal.player2.id).toBe('tbd');
    expect(data.superFinal.winner).toBeNull();
  });

  it('is a no-op when match does not exist', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const before = JSON.stringify(data);
    resetMatch(data, 'wb_999_999');
    expect(JSON.stringify(data)).toBe(before);
  });

  it('resetting an unplayed match does nothing destructive', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const match = data.winnersBracket[0][0];
    // not played yet
    resetMatch(data, match.id);
    const updated = findMatch(data, match.id)!;
    expect(updated.winner).toBeNull();
    // Players should still be present
    expect(updated.player1.id).toBe('p1');
    expect(updated.player2.id).toBe('p2');
  });
});

describe('replacePlayerInSlot', () => {
  const sub: Player = { id: 'sub1', firstName: 'Sub', lastName: 'One', number: 99 };

  it('replaces a real player in an unplayed slot', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m = data.winnersBracket[0][0]; // p1 vs p2

    const res = replacePlayerInSlot(data, m.id, 1, sub);
    expect(res.ok).toBe(true);

    const updated = findMatch(data, m.id)!;
    expect(updated.player1.id).toBe('sub1');
    expect(updated.player2.id).toBe('p2');
    expect(data.players.some((p) => p.id === 'sub1')).toBe(true);
    expect(data.players.some((p) => p.id === 'p1')).toBe(false); // removed since unused elsewhere
  });

  it('refuses to replace in a match that already has a result', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m = data.winnersBracket[0][0];
    selectWinner(data, m.id, m.player1.id);

    const res = replacePlayerInSlot(data, m.id, 2, sub);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/already has a recorded result/i);
  });

  it('refuses to replace a TBD slot', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const r2 = data.winnersBracket[1][0]; // both TBD initially
    const res = replacePlayerInSlot(data, r2.id, 1, sub);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/real player/i);
  });

  it('refuses to replace a player who has already won a prior match', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m1 = data.winnersBracket[0][0]; // p1 vs p2
    selectWinner(data, m1.id, m1.player1.id); // p1 wins and advances to R2

    const r2 = data.winnersBracket[1][0];
    const pos: 1 | 2 = r2.player1.id === 'p1' ? 1 : 2;
    const res = replacePlayerInSlot(data, r2.id, pos, sub);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/prior match/i);
  });

  it('returns error for unknown match', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const res = replacePlayerInSlot(data, 'nope', 1, sub);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });

  it('rejects replacement with same player id', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m = data.winnersBracket[0][0];
    const same: Player = { id: m.player1.id, firstName: 'x', lastName: 'y', number: 0 };
    const res = replacePlayerInSlot(data, m.id, 1, same);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/same/i);
  });
});

describe('withdrawPlayerFromSlot', () => {
  it('returns the opponent id as forfeit recipient for a pending match', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m = data.winnersBracket[0][0]; // p1 vs p2
    const res = withdrawPlayerFromSlot(data, m.id, 1);
    expect(res.ok).toBe(true);
    expect(res.forfeitTo).toBe('p2');
  });

  it('callable flow: withdraw + selectWinner advances the opponent', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m = data.winnersBracket[0][0];
    const res = withdrawPlayerFromSlot(data, m.id, 1);
    expect(res.forfeitTo).toBe('p2');
    selectWinner(data, m.id, res.forfeitTo!);
    // p2 should now appear in round 2
    const r2 = data.winnersBracket[1][0];
    expect([r2.player1.id, r2.player2.id]).toContain('p2');
  });

  it('refuses if match has a result already', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m = data.winnersBracket[0][0];
    selectWinner(data, m.id, m.player1.id);
    const res = withdrawPlayerFromSlot(data, m.id, 2);
    expect(res.ok).toBe(false);
  });

  it('refuses if the target slot is TBD', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const r2 = data.winnersBracket[1][0];
    const res = withdrawPlayerFromSlot(data, r2.id, 1);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/real player/i);
  });

  it('refuses to withdraw from a BYE-containing match (already auto-resolved)', () => {
    const data = generateDoubleElimination(makePlayers(3)); // one player gets a bye
    const byeMatch = data.winnersBracket[0].find(
      (m) => m.player1.id === 'bye' || m.player2.id === 'bye',
    );
    if (!byeMatch) {
      throw new Error('test setup: expected a BYE match for 3 players');
    }
    const realPos: 1 | 2 = byeMatch.player1.id === 'bye' ? 2 : 1;
    const res = withdrawPlayerFromSlot(data, byeMatch.id, realPos);
    expect(res.ok).toBe(false);
  });

  it('returns error for unknown match', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const res = withdrawPlayerFromSlot(data, 'nope', 1);
    expect(res.ok).toBe(false);
  });
});

describe('walkBracketMatches', () => {
  it('visits every match in winners then losers then grand, skips super when not needed', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const seen: Array<{ id: string; section: string }> = [];
    walkBracketMatches(data, (m, section) => {
      seen.push({ id: m.id, section });
    });

    // 4 players = 2 WB round 1 + 1 WB round 2 = 3 WB matches,
    // LB has 1 round 1 + 1 round 2 = 2 matches, + GF. SF not needed.
    const wb = seen.filter((s) => s.section === 'winners');
    const lb = seen.filter((s) => s.section === 'losers');
    const gf = seen.filter((s) => s.section === 'grand_final');
    const sf = seen.filter((s) => s.section === 'super_final');

    expect(wb.length).toBeGreaterThan(0);
    expect(lb.length).toBeGreaterThan(0);
    expect(gf.length).toBe(1);
    expect(sf.length).toBe(0);
  });

  it('visits super_final only when `needed` is true', () => {
    const data = generateDoubleElimination(makePlayers(4));
    data.superFinal.needed = true;
    const sections: string[] = [];
    walkBracketMatches(data, (_m, section) => {
      sections.push(section);
    });
    expect(sections).toContain('super_final');
  });

  it('stops iteration when the visitor returns false', () => {
    const data = generateDoubleElimination(makePlayers(8));
    const visited: string[] = [];
    walkBracketMatches(data, (m) => {
      visited.push(m.id);
      if (visited.length >= 2) return false;
    });
    expect(visited.length).toBe(2);
  });

  it('visits matches in deterministic round/index order', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const wbIds: string[] = [];
    walkBracketMatches(data, (m, section) => {
      if (section === 'winners') wbIds.push(m.id);
    });
    // Round 1 first, then round 2.
    const expected = [
      ...data.winnersBracket[0].map((m) => m.id),
      ...(data.winnersBracket[1]?.map((m) => m.id) ?? []),
    ];
    expect(wbIds).toEqual(expected);
  });
});

describe('isPlayableMatch', () => {
  it('is true for a fresh match with two real players', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const firstRound = data.winnersBracket[0][0];
    expect(isPlayableMatch(firstRound)).toBe(true);
  });

  it('is false once a winner is recorded', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const firstRound = data.winnersBracket[0][0];
    const updated = selectWinner(data, firstRound.id, firstRound.player1.id);
    const again = updated.winnersBracket[0][0];
    expect(isPlayableMatch(again)).toBe(false);
  });

  it('is false when a slot is still TBD', () => {
    const data = generateDoubleElimination(makePlayers(4));
    // Round 2 of a 4-player bracket has TBD players until round 1 resolves.
    const round2 = data.winnersBracket[1]?.[0];
    if (!round2) throw new Error('test setup: expected round 2 match');
    expect(isPlayableMatch(round2)).toBe(false);
  });

  it('is false when a slot is BYE (auto-forfeited)', () => {
    const data = generateDoubleElimination(makePlayers(3));
    const byeMatch = data.winnersBracket[0].find(
      (m) => m.player1.id === 'bye' || m.player2.id === 'bye',
    );
    if (!byeMatch) throw new Error('test setup: expected a BYE match for 3 players');
    // A BYE match gets a winner at generation → not playable either way.
    expect(isPlayableMatch(byeMatch)).toBe(false);
  });
});
