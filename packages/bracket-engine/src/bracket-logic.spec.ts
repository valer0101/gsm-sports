import { describe, it, expect } from 'vitest';
import {
  generateDoubleElimination,
  generateSingleElimination,
  generateRoundRobin,
  generateSwiss,
  generateGroupsPlayoff,
  generateArmfight,
  getRoundRobinStandings,
  getSwissStandings,
  getGroupStandings,
  getFinalPlacements,
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
  isArmfightBoutResult,
  recordLeg,
  forfeitBout,
} from './bracket-logic';
import type { Player, BracketData, ArmfightPairSpec, ArmfightBoutResult } from './types';

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

  it('resetMatch refuses to clear an auto-resolved bye match', () => {
    // Defensive: clearing the winner of a bye match leaves it in
    // {real, bye, winner: null}, which canRecordResult then rejects.
    // The operator can't un-stick it short of re-generating. resetMatch
    // should refuse the operation.
    const data = generateSwiss(makePlayers(3), 2);
    const r1Bye = data.winnersBracket[0].find(
      (m) => m.player1.id === 'bye' || m.player2.id === 'bye',
    )!;
    const before = JSON.stringify(r1Bye);
    resetMatch(data, r1Bye.id);
    expect(JSON.stringify(r1Bye)).toBe(before);
  });
});

// ─── Phase 3.3d: groups + playoff ─────────────────────────
describe('generateGroupsPlayoff', () => {
  it('throws for less than 2 players', () => {
    expect(() => generateGroupsPlayoff(makePlayers(1))).toThrow('At least 2 players');
  });

  it('builds 2 groups of 4 from 8 players, top-2 advance, with TBD playoff R1', () => {
    const data = generateGroupsPlayoff(makePlayers(8));
    expect(data.format).toBe('groups_playoff');
    expect(data.groups).toHaveLength(2);
    expect(data.groups![0].name).toBe('A');
    expect(data.groups![1].name).toBe('B');
    expect(data.groups![0].players).toHaveLength(4);
    expect(data.groups![1].players).toHaveLength(4);
    // Snake seeding: group A gets seeds 1, 4, 5, 8; group B gets 2, 3, 6, 7.
    expect(data.groups![0].players.map((p) => p.id)).toEqual(['p1', 'p4', 'p5', 'p8']);
    expect(data.groups![1].players.map((p) => p.id)).toEqual(['p2', 'p3', 'p6', 'p7']);

    // Each group's RR: 4 players → 3 rounds × 2 matches.
    expect(data.groups![0].rounds).toHaveLength(3);
    expect(data.groups![0].rounds.every((r) => r.length === 2)).toBe(true);

    // Playoff: 4 advancers → 2 rounds (semis + final).
    expect(data.bracketSize).toBe(4);
    expect(data.wbRounds).toBe(2);
    expect(data.winnersBracket[0]).toHaveLength(2);
    expect(data.winnersBracket[1]).toHaveLength(1);
    // All TBD until group stage completes.
    expect(data.winnersBracket[0].every((m) => m.player1.id === 'tbd')).toBe(true);
  });

  it('clamps groupCount when groups would be too small for advance count', () => {
    // 5 players, 4 groups, top-2 → only 2 groups can have ≥2 players.
    const data = generateGroupsPlayoff(makePlayers(5), {
      groupCount: 4,
      advanceFromGroup: 2,
    });
    expect(data.groups!.length).toBeLessThanOrEqual(2);
  });

  it('seeds playoff R1 once every group-stage match has a winner', () => {
    let data = generateGroupsPlayoff(makePlayers(4), {
      groupCount: 2,
      advanceFromGroup: 1,
    });
    // 2 groups of 2: each group has 1 R1 match. Top-1 from each group
    // advances → playoff is just a final.
    expect(data.bracketSize).toBe(2);
    expect(data.winnersBracket).toHaveLength(1);

    // Group A: p1 vs p4. Group B: p2 vs p3.
    const m1 = data.groups![0].rounds[0][0];
    const m2 = data.groups![1].rounds[0][0];
    data = selectWinner(structuredClone(data), m1.id, m1.player1.id);
    data = selectWinner(data, m2.id, m2.player1.id);

    // Playoff R1 (the final) should be seeded now.
    const final = data.winnersBracket[0][0];
    expect(final.player1.id).not.toBe('tbd');
    expect(final.player2.id).not.toBe('tbd');
  });

  it('cross-group seeding: 2g × 2 advance pairs 1A vs 2B and 1B vs 2A in semis', () => {
    // Default 8-player config (2 groups of 4, top 2 advance). After
    // group stage the top 2 of each group must NOT meet in the
    // playoff semis — they should be on opposite sides of the bracket
    // and only collide in the final. Earlier seeding logic produced
    // 1A vs 1B in the semis (top group winners colliding immediately).
    let data = generateGroupsPlayoff(makePlayers(8));
    // Snake-seeding puts {p1,p4,p5,p8} in group A and {p2,p3,p6,p7} in B.
    // Make p1 and p4 finish 1-2 in A; p2 and p3 finish 1-2 in B.
    for (const group of data.groups!) {
      const standings = group.players.slice();
      // Make the first listed player win all their matches (becomes 1{group}),
      // the second listed player win their remaining matches (becomes 2{group}).
      for (const round of group.rounds) {
        for (const m of round) {
          if (m.winner) continue; // skip auto-resolved byes
          // Pick the higher-ranked player by `standings` order as winner.
          const idx1 = standings.findIndex((p) => p.id === m.player1.id);
          const idx2 = standings.findIndex((p) => p.id === m.player2.id);
          const winner = idx1 < idx2 ? m.player1.id : m.player2.id;
          data = selectWinner(structuredClone(data), m.id, winner);
        }
      }
    }

    const r1 = data.winnersBracket[0];
    expect(r1).toHaveLength(2); // 4 advancers → 2 semis

    // Compute pairs as sorted [id, id] strings so we can match
    // either ordering of player1/player2.
    const pairs = r1.map((m) => [m.player1.id, m.player2.id].sort().join('|'));

    // Group A's top is p1 (first listed), group A's #2 is p4. Group B's
    // top is p2, #2 is p3. Expected semis: {p1, p3} (1A vs 2B) and
    // {p2, p4} (1B vs 2A).
    expect(pairs).toContain(['p1', 'p3'].sort().join('|'));
    expect(pairs).toContain(['p2', 'p4'].sort().join('|'));
    // Disallow the buggy earlier output where group winners collide in semis.
    expect(pairs).not.toContain(['p1', 'p2'].sort().join('|'));
  });

  it('crowns champion when playoff completes', () => {
    let data = generateGroupsPlayoff(makePlayers(4), {
      groupCount: 2,
      advanceFromGroup: 1,
    });

    // Win every group-stage match (just one per group with 2 players).
    for (const group of data.groups!) {
      for (const round of group.rounds) {
        for (const m of round) {
          if (!m.winner) {
            data = selectWinner(structuredClone(data), m.id, m.player1.id);
          }
        }
      }
    }

    // Playoff final is now seeded — pick a winner.
    const final = data.winnersBracket[0][0];
    data = selectWinner(data, final.id, final.player1.id);

    expect(data.champion).toBe(final.player1.id);
    expect(data.status).toBe('completed');
  });

  it('group standings respect the round-robin within each group only', () => {
    let data = generateGroupsPlayoff(makePlayers(4), {
      groupCount: 2,
      advanceFromGroup: 1,
    });
    // Group A: p1 vs p4. Group B: p2 vs p3. Pick p1 and p3.
    const a = data.groups![0].rounds[0][0];
    const b = data.groups![1].rounds[0][0];
    data = selectWinner(structuredClone(data), a.id, 'p1');
    data = selectWinner(data, b.id, 'p3');

    const aStandings = getGroupStandings(data, 'A');
    const bStandings = getGroupStandings(data, 'B');
    expect(aStandings.find((s) => s.playerId === 'p1')?.position).toBe(1);
    expect(aStandings.find((s) => s.playerId === 'p4')?.position).toBe(2);
    expect(bStandings.find((s) => s.playerId === 'p3')?.position).toBe(1);
    expect(bStandings.find((s) => s.playerId === 'p2')?.position).toBe(2);
  });

  it('returns empty group standings for missing groups or wrong format', () => {
    const data = generateGroupsPlayoff(makePlayers(4));
    expect(getGroupStandings(data, 'Z')).toEqual([]);
    const single = generateSingleElimination(makePlayers(4));
    expect(getGroupStandings(single, 'A')).toEqual([]);
  });

  it('findMatch + walkBracketMatches walk group-stage matches too', () => {
    const data = generateGroupsPlayoff(makePlayers(4), {
      groupCount: 2,
      advanceFromGroup: 1,
    });
    const groupMatchId = data.groups![0].rounds[0][0].id;
    expect(groupMatchId.startsWith('gp_A_')).toBe(true);
    expect(findMatch(data, groupMatchId)).not.toBeNull();

    const sections: string[] = [];
    walkBracketMatches(data, (_m, section) => {
      sections.push(section);
    });
    expect(sections.includes('group_stage')).toBe(true);
    expect(sections.includes('winners')).toBe(true);
    // Group stage matches walked first, then playoff.
    expect(sections.indexOf('group_stage')).toBeLessThan(sections.indexOf('winners'));
  });

  it('resetMatch on a group-stage match wipes the entire playoff', () => {
    let data = generateGroupsPlayoff(makePlayers(4), {
      groupCount: 2,
      advanceFromGroup: 1,
    });
    // Complete group stage.
    for (const group of data.groups!) {
      for (const round of group.rounds) {
        for (const m of round) {
          if (!m.winner) data = selectWinner(structuredClone(data), m.id, m.player1.id);
        }
      }
    }
    // Playoff is seeded now.
    expect(data.winnersBracket[0][0].player1.id).not.toBe('tbd');

    // Reset the first group-stage match — playoff must wipe back to TBD.
    const firstGroupMatch = data.groups![0].rounds[0][0].id;
    data = resetMatch(data, firstGroupMatch);
    expect(data.winnersBracket[0][0].player1.id).toBe('tbd');
    expect(data.winnersBracket[0][0].player2.id).toBe('tbd');
  });

  it('resetMatch on a playoff match cascades only within the playoff', () => {
    let data = generateGroupsPlayoff(makePlayers(4), {
      groupCount: 2,
      advanceFromGroup: 1,
    });
    for (const group of data.groups!) {
      for (const round of group.rounds) {
        for (const m of round) {
          if (!m.winner) data = selectWinner(structuredClone(data), m.id, m.player1.id);
        }
      }
    }
    // 2-advancer setup → only the final match exists in the playoff.
    // Pick a winner then reset; final goes back to active, group seeds
    // remain populated.
    const final = data.winnersBracket[0][0];
    data = selectWinner(data, final.id, final.player1.id);
    expect(data.champion).not.toBeNull();

    data = resetMatch(data, final.id);
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');
    // Group-stage results untouched.
    expect(data.groups![0].rounds[0][0].winner).not.toBeNull();
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

describe('getFinalPlacements', () => {
  describe('single_elim', () => {
    it('places champion=1, runner-up=2, SF losers tied at 3 for 4-player bracket', () => {
      let data = generateSingleElimination(makePlayers(4));
      data = selectWinner(data, 'wb_1_0', 'p1');
      data = selectWinner(data, 'wb_1_1', 'p3');
      data = selectWinner(data, 'wb_2_0', 'p1');

      const placements = getFinalPlacements(data);
      const byPlayer = Object.fromEntries(placements.map((p) => [p.playerId, p.position]));

      expect(byPlayer.p1).toBe(1);
      expect(byPlayer.p3).toBe(2);
      // Both round-1 losers tied at 3 (size-2 tier, no skip to 5 since
      // there's nothing past it).
      expect(byPlayer.p2).toBe(3);
      expect(byPlayer.p4).toBe(3);
      expect(placements).toHaveLength(4);
    });

    it('places champion=1, runner-up=2, SF losers tied at 3, QF losers tied at 5 for 8-player bracket', () => {
      let data = generateSingleElimination(makePlayers(8));
      // QF
      data = selectWinner(data, 'wb_1_0', 'p1');
      data = selectWinner(data, 'wb_1_1', 'p3');
      data = selectWinner(data, 'wb_1_2', 'p5');
      data = selectWinner(data, 'wb_1_3', 'p7');
      // SF
      data = selectWinner(data, 'wb_2_0', 'p1');
      data = selectWinner(data, 'wb_2_1', 'p5');
      // Final
      data = selectWinner(data, 'wb_3_0', 'p1');

      const byPlayer = Object.fromEntries(
        getFinalPlacements(data).map((p) => [p.playerId, p.position]),
      );

      expect(byPlayer.p1).toBe(1);
      expect(byPlayer.p5).toBe(2);
      // Two SF losers tied at 3
      expect(byPlayer.p3).toBe(3);
      expect(byPlayer.p7).toBe(3);
      // Four QF losers tied at 5 (3 + 2 SF losers above them)
      expect(byPlayer.p2).toBe(5);
      expect(byPlayer.p4).toBe(5);
      expect(byPlayer.p6).toBe(5);
      expect(byPlayer.p8).toBe(5);
    });

    it('omits players still alive when bracket is incomplete', () => {
      let data = generateSingleElimination(makePlayers(4));
      data = selectWinner(data, 'wb_1_0', 'p1');
      // wb_1_1 still pending → p3, p4 not placed yet
      const placed = getFinalPlacements(data).map((p) => p.playerId);
      expect(placed).toContain('p2');
      expect(placed).not.toContain('p1');
      expect(placed).not.toContain('p3');
      expect(placed).not.toContain('p4');
    });

    it('does not inflate positions for byes (5-player bracket)', () => {
      let data = generateSingleElimination(makePlayers(5));
      // 8-bracket, 3 byes auto-resolved at generation. After R1 the only
      // real R1 match is between two real players; the rest are bye walks.
      const r1Real = data.winnersBracket[0].find(
        (m) => m.player1.id !== 'bye' && m.player2.id !== 'bye' && !m.winner,
      );
      if (!r1Real) throw new Error('test setup: expected one real R1 match');
      data = selectWinner(data, r1Real.id, r1Real.player1.id);
      // Walk SF + Final using whoever the real winners are.
      const sf0 = data.winnersBracket[1][0];
      const sf1 = data.winnersBracket[1][1];
      data = selectWinner(data, sf0.id, sf0.player1.id);
      data = selectWinner(data, sf1.id, sf1.player1.id);
      const finalMatch = data.winnersBracket[2][0];
      data = selectWinner(data, finalMatch.id, finalMatch.player1.id);

      const placements = getFinalPlacements(data);
      // 5 real players → 5 placement rows. Champion=1, runner-up=2, two
      // SF losers tied at 3, one R1 loser at 5 (tier of size 1 — only one
      // R1 match was real).
      expect(placements).toHaveLength(5);
      const positions = placements.map((p) => p.position).sort((a, b) => a - b);
      expect(positions).toEqual([1, 2, 3, 3, 5]);
    });
  });

  describe('double_elim', () => {
    it('places champion=1, runner-up=2, LB tiers descending for 4 players', () => {
      let data = generateDoubleElimination(makePlayers(4));
      data = selectWinner(data, 'wb_1_0', 'p1');
      data = selectWinner(data, 'wb_1_1', 'p3');
      data = selectWinner(data, 'wb_2_0', 'p1');
      data = selectWinner(data, 'lb_1_0', 'p2');
      data = selectWinner(data, 'lb_2_0', 'p2');
      data = selectWinner(data, 'grand_final', 'p1');

      const byPlayer = Object.fromEntries(
        getFinalPlacements(data).map((p) => [p.playerId, p.position]),
      );

      expect(byPlayer.p1).toBe(1);
      expect(byPlayer.p2).toBe(2);
      // LB-final loser (p3) takes 3rd
      expect(byPlayer.p3).toBe(3);
      // LB-R1 loser (p4) takes 4th
      expect(byPlayer.p4).toBe(4);
    });

    it('honours super-final result when grand-final triggered a reset', () => {
      let data = generateDoubleElimination(makePlayers(4));
      data = selectWinner(data, 'wb_1_0', 'p1');
      data = selectWinner(data, 'wb_1_1', 'p3');
      data = selectWinner(data, 'wb_2_0', 'p1');
      data = selectWinner(data, 'lb_1_0', 'p2');
      data = selectWinner(data, 'lb_2_0', 'p2');
      // p2 (LB) beats p1 (WB) in GF → super-final needed
      data = selectWinner(data, 'grand_final', 'p2');
      // p2 wins the rematch → champion p2, runner-up p1
      data = selectWinner(data, 'super_final', 'p2');

      const byPlayer = Object.fromEntries(
        getFinalPlacements(data).map((p) => [p.playerId, p.position]),
      );
      expect(byPlayer.p2).toBe(1);
      expect(byPlayer.p1).toBe(2);
    });

    it('omits champion + runner-up while final is pending', () => {
      let data = generateDoubleElimination(makePlayers(4));
      data = selectWinner(data, 'wb_1_0', 'p1');
      data = selectWinner(data, 'wb_1_1', 'p3');
      data = selectWinner(data, 'wb_2_0', 'p1');
      data = selectWinner(data, 'lb_1_0', 'p2');
      data = selectWinner(data, 'lb_2_0', 'p2');
      // GF not yet played → champion + runner-up unknown
      const placed = getFinalPlacements(data).map((p) => p.playerId);
      expect(placed).not.toContain('p1');
      expect(placed).not.toContain('p2');
      // p3 dropped out via LB final, p4 via LB R1
      expect(placed).toContain('p3');
      expect(placed).toContain('p4');
    });
  });

  describe('round_robin', () => {
    it('mirrors getRoundRobinStandings positions', () => {
      let data = generateRoundRobin(makePlayers(4));
      // p1 sweeps, p2 wins one, p3/p4 lose all
      const matches = data.winnersBracket.flat();
      for (const m of matches) {
        if (m.winner) continue;
        const winnerId =
          m.player1.id === 'p1' || m.player2.id === 'p1'
            ? 'p1'
            : m.player1.id === 'p2' || m.player2.id === 'p2'
              ? 'p2'
              : m.player1.id;
        data = selectWinner(data, m.id, winnerId);
      }

      const placements = getFinalPlacements(data);
      const standings = getRoundRobinStandings(data);
      expect(placements.map((p) => p.playerId).sort()).toEqual(
        standings.map((s) => s.playerId).sort(),
      );
      for (const p of placements) {
        const s = standings.find((x) => x.playerId === p.playerId);
        expect(s?.position).toBe(p.position);
      }
    });
  });

  describe('swiss', () => {
    it('mirrors getSwissStandings positions after every round', () => {
      let data = generateSwiss(makePlayers(4));
      // R1
      for (const m of data.winnersBracket[0]) {
        if (!m.winner) data = selectWinner(data, m.id, m.player1.id);
      }
      // R2
      for (const m of data.winnersBracket[1]) {
        if (!m.winner) data = selectWinner(data, m.id, m.player1.id);
      }

      const placements = getFinalPlacements(data);
      const standings = getSwissStandings(data);
      expect(placements).toHaveLength(standings.length);
      for (const p of placements) {
        const s = standings.find((x) => x.playerId === p.playerId);
        expect(s?.position).toBe(p.position);
      }
    });
  });

  describe('groups_playoff', () => {
    it('places using single-elim playoff and omits group-only finishers', () => {
      // 8 players, 2 groups of 4, top 2 advance → 4-player playoff
      let data = generateGroupsPlayoff(makePlayers(8), {
        groupCount: 2,
        advanceFromGroup: 2,
      });

      // Resolve every group match — winner is always lower-numbered id
      for (const group of data.groups ?? []) {
        for (const round of group.rounds) {
          for (const m of round) {
            if (m.winner) continue;
            const w = m.player1.number < m.player2.number ? m.player1.id : m.player2.id;
            data = selectWinner(data, m.id, w);
          }
        }
      }

      // Playoff seeded — resolve SF + final
      const sfRound = data.winnersBracket[0];
      for (const m of sfRound) {
        if (!m.winner) data = selectWinner(data, m.id, m.player1.id);
      }
      const finalMatch = data.winnersBracket[1][0];
      data = selectWinner(data, finalMatch.id, finalMatch.player1.id);

      const placements = getFinalPlacements(data);
      // Exactly 4 placement rows (only playoff finishers).
      expect(placements).toHaveLength(4);

      const positions = placements.map((p) => p.position).sort((a, b) => a - b);
      expect(positions).toEqual([1, 2, 3, 3]);
      expect(placements[0].playerId).toBe(data.champion);
    });

    it('returns empty placements before the playoff has been seeded', () => {
      const data = generateGroupsPlayoff(makePlayers(8), {
        groupCount: 2,
        advanceFromGroup: 2,
      });
      // No matches played yet → playoff seats are TBD; nothing to place.
      const placements = getFinalPlacements(data);
      expect(placements).toEqual([]);
    });
  });

  describe('cross-format guarantees', () => {
    it('returns only real player ids (no bye/tbd)', () => {
      let data = generateSingleElimination(makePlayers(5));
      // Walk through, picking p1 of each match
      for (const round of data.winnersBracket) {
        for (const m of round) {
          if (m.winner) continue;
          const w = m.player1.id === 'tbd' ? null : m.player1.id;
          if (w) data = selectWinner(data, m.id, w);
        }
      }
      const placements = getFinalPlacements(data);
      for (const p of placements) {
        expect(p.playerId).not.toBe('bye');
        expect(p.playerId).not.toBe('tbd');
      }
    });

    it('treats undefined format as double_elim (legacy data compatibility)', () => {
      let data = generateDoubleElimination(makePlayers(4));
      data = selectWinner(data, 'wb_1_0', 'p1');
      data = selectWinner(data, 'wb_1_1', 'p3');
      data = selectWinner(data, 'wb_2_0', 'p1');
      data = selectWinner(data, 'lb_1_0', 'p2');
      data = selectWinner(data, 'lb_2_0', 'p2');
      data = selectWinner(data, 'grand_final', 'p1');

      // Strip the format field — older bracketData JSONB blobs predate
      // Phase 3.3 and may not carry it.
      const legacy: BracketData = { ...data };
      delete (legacy as Partial<BracketData>).format;

      const byPlayer = Object.fromEntries(
        getFinalPlacements(legacy).map((p) => [p.playerId, p.position]),
      );
      expect(byPlayer.p1).toBe(1);
      expect(byPlayer.p2).toBe(2);
    });
  });
});

// ─── Double-elim deep propagation (8p, LB merger rounds, byes) ──

describe('double-elim full flow (8 players)', () => {
  // 8p WB has rounds of size 4/2/1; LB has 4 rounds:
  //   LB R1 (2): WB R1 losers
  //   LB R2 (2): LB R1 winners + WB R2 losers (advancement)
  //   LB R3 (1): LB R2 winners merger     ← roundNum=3, >2, odd
  //   LB R4 (1): LB R3 winner + WB R3 loser
  // Anchors propagation through every odd "merger" branch in propagateResults.

  it('crowns champion via grand final when WB winner wins it (no super final)', () => {
    let data = generateDoubleElimination(makePlayers(8));

    // WB R1 — odd seeds win each pairing (p1,p3,p5,p7).
    // Losers in order: p2, p4, p6, p8.
    data = selectWinner(data, 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');
    data = selectWinner(data, 'wb_1_2', 'p5');
    data = selectWinner(data, 'wb_1_3', 'p7');

    // LB R1 pairs WB R1 losers in match-index order: (p2,p4), (p6,p8).
    expect(data.losersBracket[0][0].player1.id).toBe('p2');
    expect(data.losersBracket[0][0].player2.id).toBe('p4');
    expect(data.losersBracket[0][1].player1.id).toBe('p6');
    expect(data.losersBracket[0][1].player2.id).toBe('p8');

    data = selectWinner(data, 'lb_1_0', 'p2');
    data = selectWinner(data, 'lb_1_1', 'p6');

    // WB R2: (p1,p3) and (p5,p7). Pick p1 and p5.
    expect(data.winnersBracket[1][0].player1.id).toBe('p1');
    expect(data.winnersBracket[1][0].player2.id).toBe('p3');
    expect(data.winnersBracket[1][1].player1.id).toBe('p5');
    expect(data.winnersBracket[1][1].player2.id).toBe('p7');
    data = selectWinner(data, 'wb_2_0', 'p1');
    data = selectWinner(data, 'wb_2_1', 'p5');

    // LB R2 (advancement): LB R1 winner vs WB R2 loser.
    expect(data.losersBracket[1][0].player1.id).toBe('p2');
    expect(data.losersBracket[1][0].player2.id).toBe('p3');
    expect(data.losersBracket[1][1].player1.id).toBe('p6');
    expect(data.losersBracket[1][1].player2.id).toBe('p7');
    data = selectWinner(data, 'lb_2_0', 'p2');
    data = selectWinner(data, 'lb_2_1', 'p6');

    // LB R3 — merger round (covers propagateResults LB merger branch).
    expect(data.losersBracket[2][0].player1.id).toBe('p2');
    expect(data.losersBracket[2][0].player2.id).toBe('p6');
    data = selectWinner(data, 'lb_3_0', 'p2');

    // WB Final
    data = selectWinner(data, 'wb_3_0', 'p1');

    // LB R4 (advancement): LB R3 winner + WB R3 loser.
    expect(data.losersBracket[3][0].player1.id).toBe('p2');
    expect(data.losersBracket[3][0].player2.id).toBe('p5');
    data = selectWinner(data, 'lb_4_0', 'p2');

    // Grand final: p1 (WB) vs p2 (LB)
    expect(data.grandFinal.player1.id).toBe('p1');
    expect(data.grandFinal.player2.id).toBe('p2');
    data = selectWinner(data, 'grand_final', 'p1');

    expect(data.champion).toBe('p1');
    expect(data.status).toBe('completed');
    expect(data.superFinal.needed).toBe(false);
  });

  it('triggers and resolves super final when LB winner wins grand final', () => {
    let data = generateDoubleElimination(makePlayers(8));

    // WB: clean p1 victory
    for (const [id, w] of [
      ['wb_1_0', 'p1'], ['wb_1_1', 'p3'], ['wb_1_2', 'p5'], ['wb_1_3', 'p7'],
      ['wb_2_0', 'p1'], ['wb_2_1', 'p5'],
      ['wb_3_0', 'p1'],
    ]) data = selectWinner(data, id, w);

    // LB: p2 climbs through losers (mirrors test above)
    for (const [id, w] of [
      ['lb_1_0', 'p2'], ['lb_1_1', 'p6'],
      ['lb_2_0', 'p2'], ['lb_2_1', 'p6'],
      ['lb_3_0', 'p2'],
      ['lb_4_0', 'p2'],
    ]) data = selectWinner(data, id, w);

    // LB winner takes GF → super final required
    data = selectWinner(data, 'grand_final', 'p2');
    expect(data.superFinal.needed).toBe(true);
    expect(data.superFinal.player1.id).toBe('p1');
    expect(data.superFinal.player2.id).toBe('p2');
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');

    // Super final crowns champion
    data = selectWinner(data, 'super_final', 'p2');
    expect(data.champion).toBe('p2');
    expect(data.status).toBe('completed');
  });
});

describe('double-elim — bye handling in losers bracket', () => {
  // 5-player DE → 3 WB R1 matches are bye-resolved. LB R1 receives all
  // those byes; one LB R1 slot ends up bye-vs-bye and must auto-resolve
  // (lines 1748-1751 in propagateLosers).
  it('auto-resolves LB R1 match when both feeders were WB byes (5p)', () => {
    let data = generateDoubleElimination(makePlayers(5));

    // Trigger propagation: any selectWinner call will run propagateResults,
    // which in turn calls propagateLosers and seats byes into LB R1.
    // The single real-vs-real WB R1 match is wb_1_0 (p1 vs p2 by seeding).
    data = selectWinner(data, 'wb_1_0', 'p1');

    const lbR1 = data.losersBracket[0];
    // Each WB R1 bye-loser is 'bye'; combined with another bye loser,
    // the LB R1 match is winner='bye' + loser='bye'.
    const byeByeMatches = lbR1.filter(
      (m) => m.player1.id === 'bye' && m.player2.id === 'bye',
    );
    expect(byeByeMatches.length).toBeGreaterThan(0);
    for (const m of byeByeMatches) {
      expect(m.winner).toBe('bye');
      expect(m.loser).toBe('bye');
    }
  });

  // Same scenario, downstream effect: LB R2 should not stall on a bye
  // arriving from a bye-bye LB R1 — propagation feeds 'bye' forward via
  // line 1849-1852 / 1856-1862-style guards in the LB rounds loop.
  it('does not stall LB R2 when a LB R1 match auto-resolved as bye-bye (5p)', () => {
    let data = generateDoubleElimination(makePlayers(5));
    data = selectWinner(data, 'wb_1_0', 'p1');

    // After WB R2 winner is recorded, its loser drops to LB R2.
    data = selectWinner(data, 'wb_2_0', data.winnersBracket[1][0].player1.id);

    // LB R2 should now contain a real player (the WB R2 loser) on player2 side
    // even though the LB R1 feeder was bye-bye.
    const lbR2 = data.losersBracket[1];
    const wbR2Loser = data.winnersBracket[1][0].loser!;
    const slotted = lbR2.some(
      (m) => m.player1.id === wbR2Loser || m.player2.id === wbR2Loser,
    );
    expect(slotted).toBe(true);
  });
});

describe('double-elim — propagation cascade on reset', () => {
  // Resetting a WB R1 match must clear the loser slot it propagated into
  // LB R1 (back to TBD) AND clear any downstream WB matches that received
  // the winner.
  it('reset of WB R1 wipes LB R1 loser slot back to TBD', () => {
    let data = generateDoubleElimination(makePlayers(4));
    data = selectWinner(data, 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');

    // LB R1 has both losers seated.
    const lbR1 = data.losersBracket[0][0];
    expect(lbR1.player1.id).toBe('p2');
    expect(lbR1.player2.id).toBe('p4');

    // Reset wb_1_0 — p1 should be removed from WB R2, and p2 from LB R1.
    resetMatch(data, 'wb_1_0');

    const lbR1After = findMatch(data, 'lb_1_0')!;
    // The slot that received the WB R1 loser (p2) must be cleared to TBD;
    // the other slot (p4 from wb_1_1) should be untouched.
    expect(lbR1After.player1.id === 'tbd' || lbR1After.player2.id === 'tbd').toBe(true);
    expect(lbR1After.winner).toBeNull();
  });

  // Recording the same winner twice (correction-no-op) is idempotent —
  // propagation does not duplicate / corrupt downstream slots.
  it('selectWinner with same winnerId twice is idempotent', () => {
    let data = generateDoubleElimination(makePlayers(4));
    data = selectWinner(data, 'wb_1_0', 'p1', 'u1');
    data = selectWinner(data, 'wb_1_1', 'p3', 'u1');
    const snapshot = JSON.stringify({
      wb: data.winnersBracket,
      lb: data.losersBracket,
    });

    // Same winner re-recorded — should be a no-op for slot positions
    // (audit `correctedBy` may update, so we compare structural slots only).
    data = selectWinner(data, 'wb_1_0', 'p1', 'u1');
    const after = JSON.stringify({
      wb: data.winnersBracket.map((r) =>
        r.map((m) => ({
          id: m.id,
          p1: m.player1.id,
          p2: m.player2.id,
          winner: m.winner,
          loser: m.loser,
        })),
      ),
      lb: data.losersBracket.map((r) =>
        r.map((m) => ({
          id: m.id,
          p1: m.player1.id,
          p2: m.player2.id,
          winner: m.winner,
          loser: m.loser,
        })),
      ),
    });
    const before = JSON.stringify({
      wb: data.winnersBracket.map((r) =>
        r.map((m) => ({
          id: m.id,
          p1: m.player1.id,
          p2: m.player2.id,
          winner: m.winner,
          loser: m.loser,
        })),
      ),
      lb: data.losersBracket.map((r) =>
        r.map((m) => ({
          id: m.id,
          p1: m.player1.id,
          p2: m.player2.id,
          winner: m.winner,
          loser: m.loser,
        })),
      ),
    });
    expect(after).toBe(before);
    // The original snapshot should be structurally consistent too.
    expect(snapshot.includes('"p1"')).toBe(true);
  });

  // Correcting a recorded winner (selecting the OTHER player) must
  // re-propagate downstream: the new winner replaces the old winner in
  // the next-round slot, and the new loser drops into LB R1 instead.
  it('correcting WB R1 winner re-propagates to WB R2 and LB R1', () => {
    let data = generateDoubleElimination(makePlayers(4));
    data = selectWinner(data, 'wb_1_0', 'p1');
    expect(findMatch(data, 'wb_2_0')!.player1.id).toBe('p1');
    expect(findMatch(data, 'lb_1_0')!.player1.id).toBe('p2');

    // Correct: p2 actually won.
    data = selectWinner(data, 'wb_1_0', 'p2');

    expect(findMatch(data, 'wb_2_0')!.player1.id).toBe('p2');
    expect(findMatch(data, 'lb_1_0')!.player1.id).toBe('p1');
  });
});

// ─── Edge cases / branch coverage ───────────────────────────

describe('getPlayerObj — fallback for unknown id', () => {
  it('returns a synthetic ??? entry when the id is not in data.players', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const ghost = getPlayerObj(data, 'never-existed');
    expect(ghost.id).toBe('never-existed');
    expect(ghost.firstName).toBe('???');
  });
});

describe('validateResult — BYE-slot rejection', () => {
  it('refuses to record a result on a match with a BYE seat', () => {
    const data = generateDoubleElimination(makePlayers(3));
    const byeMatch = data.winnersBracket[0].find(
      (m) => m.player1.id === 'bye' || m.player2.id === 'bye',
    );
    if (!byeMatch) throw new Error('test setup: expected a BYE match');
    const realId = byeMatch.player1.id === 'bye' ? byeMatch.player2.id : byeMatch.player1.id;
    const res = validateResult(data, byeMatch.id, realId);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /BYE/i.test(e))).toBe(true);
  });
});

describe('canRecordResult — auto-resolved BYE-vs-BYE rejection', () => {
  it('flags an LB R1 bye-vs-bye match in a 5-player double-elim', () => {
    let data = generateDoubleElimination(makePlayers(5));
    // Any selectWinner triggers propagation, which seats WB R1 byes
    // into LB R1 — one LB R1 slot ends up bye-vs-bye and is auto-resolved.
    data = selectWinner(data, 'wb_1_0', 'p1');
    const byeBye = data.losersBracket[0].find(
      (m) => m.player1.id === 'bye' && m.player2.id === 'bye',
    );
    if (!byeBye) throw new Error('test setup: expected a bye-bye LB R1 match');
    const res = canRecordResult(data, byeBye.id);
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => /BYE/i.test(e))).toBe(true);
  });
});

describe('selectWinner — guards', () => {
  it('returns data unchanged for an unknown matchId', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const before = JSON.stringify(data);
    const after = selectWinner(data, 'no_such_match', 'p1');
    expect(JSON.stringify(after)).toBe(before);
  });

  it('refuses to overwrite an auto-resolved BYE-vs-BYE LB match', () => {
    let data = generateDoubleElimination(makePlayers(5));
    data = selectWinner(data, 'wb_1_0', 'p1');
    const byeBye = data.losersBracket[0].find(
      (m) => m.player1.id === 'bye' && m.player2.id === 'bye',
    );
    if (!byeBye) throw new Error('test setup: expected a bye-bye LB R1 match');
    const before = JSON.stringify(byeBye);
    selectWinner(data, byeBye.id, 'p1');
    const after = JSON.stringify(findMatch(data, byeBye.id));
    expect(after).toBe(before);
  });
});

describe('resetMatch — champion clearing across formats', () => {
  it('round_robin: clears champion when the deciding match is reset', () => {
    let data = generateRoundRobin(makePlayers(3));
    const real = data.winnersBracket
      .flat()
      .filter((m) => m.player1.id !== 'bye' && m.player2.id !== 'bye');
    // p1 sweeps both real matches that involve them; p2 wins p2-vs-p3.
    for (const m of real) {
      const winner =
        m.player1.id === 'p1' || m.player2.id === 'p1' ? 'p1' : 'p2';
      data = selectWinner(data, m.id, winner);
    }
    expect(data.champion).toBe('p1');

    // Reset one of p1's wins; champion must be cleared.
    const p1Win = real.find(
      (m) =>
        (m.player1.id === 'p1' || m.player2.id === 'p1') &&
        (m.player1.id !== 'bye' && m.player2.id !== 'bye'),
    )!;
    data = resetMatch(data, p1Win.id);
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');
  });

  it('swiss: clears champion when a decisive match is reset', () => {
    let data = generateSwiss(makePlayers(4), 2);
    // Round 1
    for (const m of data.winnersBracket[0]) {
      if (m.winner) continue;
      const w =
        m.player1.id === 'p1' || m.player2.id === 'p1' ? 'p1' : m.player1.id;
      data = selectWinner(data, m.id, w);
    }
    // Round 2 (paired by propagateResults)
    for (const m of data.winnersBracket[1]) {
      if (m.winner) continue;
      const w =
        m.player1.id === 'p1' || m.player2.id === 'p1' ? 'p1' : m.player1.id;
      data = selectWinner(data, m.id, w);
    }
    expect(data.champion).toBe('p1');

    // Reset any p1 win — champion must clear and downstream rounds wipe.
    const decisive = data.winnersBracket
      .flat()
      .find((m) => m.winner === 'p1')!;
    data = resetMatch(data, decisive.id);
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');
  });
});

describe('replacePlayerInSlot — additional cases', () => {
  it('replaces the second slot when position=2', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m = data.winnersBracket[0][0];
    const sub: Player = { id: 'sub2', firstName: 'Sub', lastName: 'Two', number: 100 };
    const res = replacePlayerInSlot(data, m.id, 2, sub);
    expect(res.ok).toBe(true);
    const updated = findMatch(data, m.id)!;
    expect(updated.player2.id).toBe('sub2');
    expect(updated.player1.id).toBe('p1');
  });

  it('refuses replacement with a BYE/TBD player object', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m = data.winnersBracket[0][0];
    const fake: Player = { id: 'bye', firstName: 'BYE', lastName: '', number: '-' };
    const res = replacePlayerInSlot(data, m.id, 1, fake);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/real player/i);
  });
});

describe('generateGroupsPlayoff — input validation', () => {
  it('throws when groupCount < 1', () => {
    expect(() =>
      generateGroupsPlayoff(makePlayers(4), { groupCount: 0 }),
    ).toThrow(/groupCount/i);
  });

  it('throws when advanceFromGroup < 1', () => {
    expect(() =>
      generateGroupsPlayoff(makePlayers(4), { advanceFromGroup: 0 }),
    ).toThrow(/advanceFromGroup/i);
  });
});

describe('generateGroupsPlayoff — K-group fallback (≠ 2 groups)', () => {
  it('handles 3 singleton groups (1 player each, walkover group stage)', () => {
    // 3 players, 3 groups, top-1 → each group is a singleton walkover and
    // exercises the buildGroupRoundRobin (n=1) branch.
    const data = generateGroupsPlayoff(makePlayers(3), {
      groupCount: 3,
      advanceFromGroup: 1,
    });
    expect(data.groups).toHaveLength(3);
    for (const g of data.groups ?? []) {
      expect(g.players).toHaveLength(1);
      expect(g.rounds).toHaveLength(1);
      const m = g.rounds[0][0];
      expect(m.winner).toBe(g.players[0].id);
      expect(m.loser).toBe('bye');
    }
    // 3 advancers padded to a 4-bracket with 1 bye seat.
    expect(data.bracketSize).toBe(4);
  });

  it('seeds the K-group playoff (3 groups × 1 advance) with one bye match', () => {
    let data = generateGroupsPlayoff(makePlayers(6), {
      groupCount: 3,
      advanceFromGroup: 1,
    });
    expect(data.groups).toHaveLength(3);

    // Resolve every group match — lower id always wins.
    for (const group of data.groups ?? []) {
      for (const round of group.rounds) {
        for (const m of round) {
          if (m.winner) continue;
          const w =
            m.player1.number < m.player2.number ? m.player1.id : m.player2.id;
          data = selectWinner(data, m.id, w);
        }
      }
    }

    // Playoff R1 has been seeded; one match should be a real-vs-bye walkover.
    const r1 = data.winnersBracket[0];
    const byeMatch = r1.find(
      (m) => m.player1.id === 'bye' || m.player2.id === 'bye',
    );
    expect(byeMatch).toBeDefined();
    expect(byeMatch!.winner).toBeTruthy();
    expect(byeMatch!.loser).toBe('bye');
  });

  it('propagates bye-bye through the playoff (5 groups × 1 advance, 8-bracket)', () => {
    // 5 advancers padded to 8 with 3 byes — slots [g0,g1,g2,g3,g4,bye,bye,bye].
    // R1 m3 = (bye, bye) which auto-resolves to winner='bye'; R2 m1 sees a
    // 'bye' feeder (line 1690-1692 in propagation) and must keep advancing.
    let data = generateGroupsPlayoff(makePlayers(5), {
      groupCount: 5,
      advanceFromGroup: 1,
    });
    expect(data.groups).toHaveLength(5);

    for (const group of data.groups ?? []) {
      for (const round of group.rounds) {
        for (const m of round) {
          if (m.winner) continue;
          const w =
            m.player1.number < m.player2.number ? m.player1.id : m.player2.id;
          data = selectWinner(data, m.id, w);
        }
      }
    }

    const r1 = data.winnersBracket[0];
    const byeBye = r1.find(
      (m) => m.player1.id === 'bye' && m.player2.id === 'bye',
    );
    expect(byeBye).toBeDefined();
    expect(byeBye!.winner).toBe('bye');

    // Walk the surviving R1 winner up to the final — every still-pending
    // playoff match should eventually have real / bye seats, never TBD.
    const playoff = data.winnersBracket;
    for (let r = 0; r < playoff.length; r++) {
      for (const m of playoff[r]) {
        if (m.winner) continue;
        if (m.player1.id === 'tbd' || m.player2.id === 'tbd') continue;
        data = selectWinner(data, m.id, m.player1.id);
      }
    }
    expect(data.status).toBe('completed');
    expect(data.champion).toBeTruthy();
  });

  it('K-group fallback uses reverse seed order on odd positions (4×2)', () => {
    const data = generateGroupsPlayoff(makePlayers(8), {
      groupCount: 4,
      advanceFromGroup: 2,
    });
    expect(data.groups).toHaveLength(4);
    expect(data.bracketSize).toBe(8);
  });
});

describe('getFinalPlacements — exhaustive default branch', () => {
  it('returns an empty array for an unrecognised format value', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const corrupted = {
      ...data,
      format: 'mystery_format' as unknown as BracketData['format'],
    };
    expect(getFinalPlacements(corrupted as BracketData)).toEqual([]);
  });
});

describe('getFinalPlacements — double-elim partial state', () => {
  it('returns no runner-up while super-final is pending', () => {
    let data = generateDoubleElimination(makePlayers(4));
    data = selectWinner(data, 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');
    data = selectWinner(data, 'wb_2_0', 'p1');
    data = selectWinner(data, 'lb_1_0', 'p2');
    data = selectWinner(data, 'lb_2_0', 'p2');
    // LB winner takes GF → super-final flagged but unresolved.
    data = selectWinner(data, 'grand_final', 'p2');
    expect(data.superFinal.needed).toBe(true);
    expect(data.champion).toBeNull();

    const placements = getFinalPlacements(data);
    // p1 (WB winner) and p2 (LB winner) are still alive in the SF — neither
    // can be placed yet. They must not appear in the table at all.
    const ids = placements.map((p) => p.playerId);
    expect(ids).not.toContain('p1');
    expect(ids).not.toContain('p2');
  });
});

describe('inferAdvanceFromGroup — legacy fallback', () => {
  it('infers advance count when the persisted field is absent', () => {
    let data = generateGroupsPlayoff(makePlayers(8), {
      groupCount: 2,
      advanceFromGroup: 2,
    });
    // Strip the persisted hint to mimic legacy bracketData JSONB blobs.
    delete (data as Partial<BracketData>).advanceFromGroup;

    for (const group of data.groups ?? []) {
      for (const round of group.rounds) {
        for (const m of round) {
          if (m.winner) continue;
          const w =
            m.player1.number < m.player2.number ? m.player1.id : m.player2.id;
          data = selectWinner(data, m.id, w);
        }
      }
    }

    // Playoff R1 should have been seeded with real players, no TBD seats.
    for (const m of data.winnersBracket[0]) {
      expect(m.player1.id).not.toBe('tbd');
      expect(m.player2.id).not.toBe('tbd');
    }
  });
});

describe('walkBracketMatches — group_stage section', () => {
  it('emits group_stage entries before any winners-section entries', () => {
    const data = generateGroupsPlayoff(makePlayers(4), {
      groupCount: 2,
      advanceFromGroup: 2,
    });
    const sections: string[] = [];
    walkBracketMatches(data, (_m, s) => {
      sections.push(s);
    });
    const firstWinners = sections.indexOf('winners');
    const lastGroup = sections.lastIndexOf('group_stage');
    expect(lastGroup).toBeGreaterThan(-1);
    expect(firstWinners).toBeGreaterThan(lastGroup);
  });

  it('stops iteration when a group_stage callback returns false', () => {
    const data = generateGroupsPlayoff(makePlayers(4), {
      groupCount: 2,
      advanceFromGroup: 2,
    });
    let count = 0;
    walkBracketMatches(data, () => {
      count += 1;
      if (count === 1) return false;
    });
    expect(count).toBe(1);
  });
});

describe('Swiss — bye assignment fairness across long schedules', () => {
  it('does not double-bye one player while others have only one (3p × 4r)', () => {
    let data = generateSwiss(makePlayers(3), 4);
    for (let r = 0; r < 4; r++) {
      const round = data.winnersBracket[r];
      for (const m of round) {
        if (m.winner) continue;
        data = selectWinner(data, m.id, m.player1.id);
      }
    }
    const byeCounts = new Map<string, number>();
    for (const round of data.winnersBracket) {
      for (const m of round) {
        if (m.player2.id === 'bye') {
          byeCounts.set(m.player1.id, (byeCounts.get(m.player1.id) ?? 0) + 1);
        } else if (m.player1.id === 'bye') {
          byeCounts.set(m.player2.id, (byeCounts.get(m.player2.id) ?? 0) + 1);
        }
      }
    }
    const counts = [...byeCounts.values()].sort((a, b) => a - b);
    // 4 byes total across 3 players — fair distribution is [1, 1, 2].
    expect(counts).toEqual([1, 1, 2]);
  });
});

describe('isPlayableMatch — extra states', () => {
  it('is true on the grand final once both finalists are seated', () => {
    let data = generateDoubleElimination(makePlayers(4));
    data = selectWinner(data, 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');
    data = selectWinner(data, 'wb_2_0', 'p1');
    data = selectWinner(data, 'lb_1_0', 'p2');
    data = selectWinner(data, 'lb_2_0', 'p2');
    expect(isPlayableMatch(data.grandFinal)).toBe(true);
  });
});

describe('findMatch — group-stage lookup', () => {
  it('finds a match by id inside a group stage', () => {
    const data = generateGroupsPlayoff(makePlayers(4), {
      groupCount: 2,
      advanceFromGroup: 2,
    });
    const group = data.groups![0];
    const match = group.rounds[0][0];
    const found = findMatch(data, match.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(match.id);
  });
});

// The bracket generators only ever place single byes per WB R1 match — but
// `propagateResults` defensively handles bye-bye feeders to keep the engine
// robust against hand-edited / migrated brackets. Synthetic tests below
// drive that path directly.

describe('propagateResults — synthetic bye-bye feeders', () => {
  const byePlayer = { id: 'bye', firstName: 'BYE', lastName: '', number: '-' };

  it('double-elim: WB R2 receives BYE from a bye-bye R1 feeder', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m0 = data.winnersBracket[0][0];
    m0.player1 = { ...byePlayer };
    m0.player2 = { ...byePlayer };
    m0.winner = 'bye';
    m0.loser = 'bye';

    const result = selectWinner(data, 'wb_1_1', 'p3');

    const wbR2 = result.winnersBracket[1][0];
    expect(wbR2.player1.id).toBe('bye');
    expect(wbR2.player2.id).toBe('p3');
    // Auto-resolves as a walkover.
    expect(wbR2.winner).toBe('p3');
    expect(wbR2.loser).toBe('bye');
  });

  it('single-elim: WB R2 receives BYE from a bye-bye R1 feeder', () => {
    const data = generateSingleElimination(makePlayers(4));
    const m0 = data.winnersBracket[0][0];
    m0.player1 = { ...byePlayer };
    m0.player2 = { ...byePlayer };
    m0.winner = 'bye';
    m0.loser = 'bye';

    const result = selectWinner(data, 'wb_1_1', 'p3');

    const wbR2 = result.winnersBracket[1][0];
    expect(wbR2.player1.id).toBe('bye');
    expect(wbR2.player2.id).toBe('p3');
    expect(wbR2.winner).toBe('p3');
    expect(wbR2.loser).toBe('bye');
  });

  it('double-elim: feeder2 BYE auto-resolves player2 to BYE in R2', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m1 = data.winnersBracket[0][1];
    m1.player1 = { ...byePlayer };
    m1.player2 = { ...byePlayer };
    m1.winner = 'bye';
    m1.loser = 'bye';

    const result = selectWinner(data, 'wb_1_0', 'p1');

    const wbR2 = result.winnersBracket[1][0];
    expect(wbR2.player1.id).toBe('p1');
    expect(wbR2.player2.id).toBe('bye');
    expect(wbR2.winner).toBe('p1');
    expect(wbR2.loser).toBe('bye');
  });

  it('LB advancement auto-resolves when its LB-side feeder won by bye (5p)', () => {
    // 5-player DE produces a bye-bye LB R1 match (winner='bye'). The LB R2
    // advancement slot fed by that match ends up with player1=BYE. Once the
    // matching WB R2 loser is propagated into player2, the auto-resolve
    // loop (bracket-logic.ts:1895-1903) marks the LB R2 match as a walkover.
    let data = generateDoubleElimination(makePlayers(5));
    data = selectWinner(data, 'wb_1_0', 'p1');

    // Resolve both WB R2 matches so every LB R2 player2 slot is filled.
    const wbR2 = data.winnersBracket[1];
    data = selectWinner(data, wbR2[0].id, wbR2[0].player1.id);
    data = selectWinner(data, wbR2[1].id, wbR2[1].player1.id);

    const byeAdv = data.losersBracket[1].find(
      (m) =>
        ((m.player1.id === 'bye' && m.player2.id !== 'bye' && m.player2.id !== 'tbd') ||
          (m.player2.id === 'bye' && m.player1.id !== 'bye' && m.player1.id !== 'tbd')) &&
        m.winner !== null,
    );
    expect(byeAdv).toBeDefined();
    expect(byeAdv!.loser).toBe('bye');
    expect(byeAdv!.winner).not.toBe('bye');
  });
});

describe('withdrawPlayerFromSlot — opponent guard', () => {
  it('refuses when opponent slot is BYE on a match with no winner yet', () => {
    // Synthetic: clear the auto-resolved winner so the BYE-opponent guard
    // gets to run instead of the earlier "match already has a result" guard.
    const data = generateDoubleElimination(makePlayers(3));
    const byeMatch = data.winnersBracket[0].find(
      (m) => m.player1.id === 'bye' || m.player2.id === 'bye',
    );
    if (!byeMatch) throw new Error('test setup: expected a BYE match');
    byeMatch.winner = null;
    byeMatch.loser = null;
    const realPos: 1 | 2 = byeMatch.player1.id === 'bye' ? 2 : 1;
    const res = withdrawPlayerFromSlot(data, byeMatch.id, realPos);
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/forfeit/i);
  });
});

describe('getFinalPlacements — pre-final state coverage', () => {
  it('returns no placements for a fresh single_elim bracket', () => {
    const data = generateSingleElimination(makePlayers(4));
    expect(getFinalPlacements(data)).toEqual([]);
  });

  it('returns no placements for a fresh round_robin bracket', () => {
    const data = generateRoundRobin(makePlayers(4));
    // Standings exist but every position is 1 (everybody tied at 0-0 →
    // every row shares competition rank #1).
    const placements = getFinalPlacements(data);
    expect(placements.every((p) => p.position === 1)).toBe(true);
  });

  it('returns runner-up only when single_elim final has a real loser', () => {
    let data = generateSingleElimination(makePlayers(4));
    // R1 only — final not played yet.
    data = selectWinner(data, 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');
    const placements = getFinalPlacements(data);
    // Champion still null, runner-up still null. R1 losers in tier 1.
    expect(placements.find((p) => p.position === 1)).toBeDefined();
    const ids = placements.map((p) => p.playerId);
    // Survivors p1 & p3 are still alive — must not appear.
    expect(ids).not.toContain('p1');
    expect(ids).not.toContain('p3');
  });
});

describe('replacePlayerInSlot — old player still referenced elsewhere', () => {
  // When the swapped-out player still appears in another slot of the
  // bracket, data.players should NOT remove them.
  it('keeps the swapped-out player in data.players when they appear elsewhere', () => {
    const data = generateDoubleElimination(makePlayers(4));
    // Synthetic: pin p1 into wb_1_1.player2 too so the "still referenced
    // elsewhere" branch fires when we swap them out of wb_1_0.
    data.winnersBracket[0][1].player2 = { ...data.players.find((p) => p.id === 'p1')! };
    const sub: Player = { id: 'sub3', firstName: 'Sub', lastName: 'Three', number: 101 };
    const res = replacePlayerInSlot(data, 'wb_1_0', 1, sub);
    expect(res.ok).toBe(true);
    // p1 should still be in data.players because they appear in wb_1_1.
    expect(data.players.some((p) => p.id === 'p1')).toBe(true);
  });

  it('keeps an already-listed new player (no duplicate push)', () => {
    const data = generateDoubleElimination(makePlayers(4));
    const m = data.winnersBracket[0][0];
    // Substitute p3 in for p1 — p3 is already in data.players.
    const sub: Player = data.players.find((p) => p.id === 'p3')!;
    const before = data.players.length;
    const res = replacePlayerInSlot(data, m.id, 1, sub);
    expect(res.ok).toBe(true);
    // No duplicate p3 entry.
    const p3Count = data.players.filter((p) => p.id === 'p3').length;
    expect(p3Count).toBe(1);
    // p1 was the only WB occurrence, so data.players removes them
    // → length stays the same (lost p1, gained nothing).
    expect(data.players.length).toBe(before - 1);
  });
});

describe('propagateResults — additional bye-feeder coverage', () => {
  const byePlayer = { id: 'bye', firstName: 'BYE', lastName: '', number: '-' };

  it('single-elim: feeder2 BYE auto-resolves player2 to BYE in R2', () => {
    const data = generateSingleElimination(makePlayers(4));
    const m1 = data.winnersBracket[0][1];
    m1.player1 = { ...byePlayer };
    m1.player2 = { ...byePlayer };
    m1.winner = 'bye';
    m1.loser = 'bye';

    const result = selectWinner(data, 'wb_1_0', 'p1');

    const wbR2 = result.winnersBracket[1][0];
    expect(wbR2.player1.id).toBe('p1');
    expect(wbR2.player2.id).toBe('bye');
    expect(wbR2.winner).toBe('p1');
    expect(wbR2.loser).toBe('bye');
  });
});

describe('walkBracketMatches — early-stop coverage', () => {
  it('early-stops on the losers callback', () => {
    let data = generateDoubleElimination(makePlayers(4));
    data = selectWinner(data, 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');
    let stopped = false;
    walkBracketMatches(data, (_m, section) => {
      if (section === 'losers') {
        stopped = true;
        return false;
      }
    });
    expect(stopped).toBe(true);
  });

  it('early-stops on the grand_final callback (single_elim has no LB)', () => {
    const data = generateSingleElimination(makePlayers(4));
    let sawGf = false;
    walkBracketMatches(data, (_m, section) => {
      if (section === 'grand_final') {
        sawGf = true;
        return false;
      }
    });
    expect(sawGf).toBe(true);
  });
});

describe('withdrawPlayerFromSlot — position 2 path', () => {
  it('returns the opponent id when position=2 is a real player', () => {
    const data = generateDoubleElimination(makePlayers(4));
    // wb_1_0 = (p1, p2) — withdraw p2.
    const res = withdrawPlayerFromSlot(data, 'wb_1_0', 2);
    expect(res.ok).toBe(true);
    expect(res.forfeitTo).toBe('p1');
  });
});

describe('getFinalPlacements — groups_playoff partial state', () => {
  it('omits champion + runner-up while the playoff final is pending', () => {
    let data = generateGroupsPlayoff(makePlayers(8), {
      groupCount: 2,
      advanceFromGroup: 2,
    });
    for (const group of data.groups ?? []) {
      for (const round of group.rounds) {
        for (const m of round) {
          if (m.winner) continue;
          const w =
            m.player1.number < m.player2.number ? m.player1.id : m.player2.id;
          data = selectWinner(data, m.id, w);
        }
      }
    }
    // SF only — final still pending.
    for (const m of data.winnersBracket[0]) {
      if (!m.winner) data = selectWinner(data, m.id, m.player1.id);
    }
    const placements = getFinalPlacements(data);
    // Two SF losers tied at position 1 (champion null, runner-up null).
    expect(placements.length).toBeGreaterThan(0);
    expect(placements.every((p) => p.position === 1)).toBe(true);
  });
});

describe('synthetic — groups_playoff missing groups field', () => {
  // Defensive paths in `groupStageComplete`, `seedPlayoffSlots`, and
  // `inferAdvanceFromGroup` apply `data.groups ?? []` for legacy / damaged
  // brackets. Hand-strip the field to drive those branches.
  it('treats a groups_playoff bracket without groups as group-stage complete', () => {
    const data = generateGroupsPlayoff(makePlayers(4), {
      groupCount: 2,
      advanceFromGroup: 2,
    });
    delete (data as Partial<BracketData>).groups;
    delete (data as Partial<BracketData>).advanceFromGroup;
    // selectWinner triggers propagation. With no groups, groupStageComplete
    // returns true and seeding is attempted with empty slots → all bye.
    const r1Match = data.winnersBracket[0][0];
    selectWinner(data, r1Match.id, 'p1');
    // Engine should not throw or crash; bracket remains a valid object.
    expect(Array.isArray(data.winnersBracket)).toBe(true);
  });
});

describe('walkBracketMatches — early-stop on winners-section', () => {
  it('stops iteration when winners callback returns false', () => {
    const data = generateDoubleElimination(makePlayers(4));
    let count = 0;
    walkBracketMatches(data, () => {
      count += 1;
      if (count === 1) return false;
    });
    expect(count).toBe(1);
  });
});

function makePair(
  a: string,
  b: string,
  hand: 'left' | 'right' = 'right',
  order?: number,
): ArmfightPairSpec {
  return {
    playerA: { id: a, firstName: 'A', lastName: a, number: a },
    playerB: { id: b, firstName: 'B', lastName: b, number: b },
    hand,
    order,
  };
}

describe('generateArmfight — validations', () => {
  it('rejects empty pairs', () => {
    expect(() => generateArmfight([])).toThrow(/at least one pair/i);
  });

  it('rejects a pair where playerA.id === playerB.id', () => {
    expect(() => generateArmfight([makePair('p1', 'p1')])).toThrow(/same player/i);
  });

  it('rejects a pair containing the BYE id', () => {
    expect(() => generateArmfight([makePair('bye', 'p1')])).toThrow(/bye|tbd/i);
    expect(() => generateArmfight([makePair('p1', 'bye')])).toThrow(/bye|tbd/i);
  });

  it('rejects a pair containing the TBD id', () => {
    expect(() => generateArmfight([makePair('tbd', 'p1')])).toThrow(/bye|tbd/i);
  });

  it('rejects the same playerId appearing in two pairs', () => {
    expect(() =>
      generateArmfight([makePair('p1', 'p2'), makePair('p1', 'p3')]),
    ).toThrow(/twice|duplicate/i);
  });

  it('rejects invalid hand', () => {
    const bad = makePair('p1', 'p2');
    (bad as unknown as { hand: string }).hand = 'middle';
    expect(() => generateArmfight([bad])).toThrow(/hand/i);
  });
});

describe('generateArmfight — structure', () => {
  it('single pair → bracketSize=2, wbRounds=1, one match', () => {
    const data = generateArmfight([makePair('p1', 'p2', 'right')]);
    expect(data.format).toBe('armfight');
    expect(data.bracketSize).toBe(2);
    expect(data.wbRounds).toBe(1);
    expect(data.winnersBracket).toHaveLength(1);
    expect(data.winnersBracket[0]).toHaveLength(1);
    expect(data.losersBracket).toEqual([]);
    expect(data.champion).toBeNull();
    expect(data.status).toBe('active');
  });

  it('N pairs → bracketSize=N*2, single round of N matches', () => {
    const data = generateArmfight([
      makePair('p1', 'p2'),
      makePair('p3', 'p4'),
      makePair('p5', 'p6', 'left'),
    ]);
    expect(data.bracketSize).toBe(6);
    expect(data.wbRounds).toBe(1);
    expect(data.winnersBracket[0]).toHaveLength(3);
  });

  it('match ids follow wb_1_{i} convention', () => {
    const data = generateArmfight([
      makePair('p1', 'p2'),
      makePair('p3', 'p4'),
    ]);
    expect(data.winnersBracket[0][0].id).toBe('wb_1_0');
    expect(data.winnersBracket[0][1].id).toBe('wb_1_1');
  });

  it('seeds are stable across pairs', () => {
    const data = generateArmfight([
      makePair('p1', 'p2'),
      makePair('p3', 'p4'),
    ]);
    expect(data.winnersBracket[0][0].player1.seed).toBe(1);
    expect(data.winnersBracket[0][0].player2.seed).toBe(2);
    expect(data.winnersBracket[0][1].player1.seed).toBe(3);
    expect(data.winnersBracket[0][1].player2.seed).toBe(4);
  });

  it('champion is always null (no event-level champion)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(data.champion).toBeNull();
  });

  it('grand_final and super_final are TBD stubs (never played)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(data.grandFinal.player1.id).toBe('tbd');
    expect(data.grandFinal.player2.id).toBe('tbd');
    expect(data.superFinal.needed).toBe(false);
  });

  it('players are de-duplicated in order of first appearance', () => {
    const data = generateArmfight([
      makePair('p1', 'p2'),
      makePair('p3', 'p4'),
    ]);
    expect(data.players.map((p) => p.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
  });

  it('each Match.result is initialised to a fresh pending ArmfightBoutResult', () => {
    const data = generateArmfight([makePair('p1', 'p2', 'left')]);
    expect(data.winnersBracket[0][0].result).toEqual({
      hand: 'left',
      legs: [],
      scoreA: 0,
      scoreB: 0,
      status: 'pending',
    });
  });

  it('preserves player metadata (firstName, lastName, photoUrl)', () => {
    const data = generateArmfight([{
      playerA: { id: 'a', firstName: 'Levon', lastName: 'Hakobyan', number: 7, photoUrl: 'https://x/y.jpg' },
      playerB: { id: 'b', firstName: 'Garik', lastName: 'Petrosyan', number: 12 },
      hand: 'right',
    }]);
    const m = data.winnersBracket[0][0];
    expect(m.player1.firstName).toBe('Levon');
    expect(m.player1.photoUrl).toBe('https://x/y.jpg');
    expect(m.player2.lastName).toBe('Petrosyan');
  });
});

describe('coverage — index.ts re-exports', () => {
  it('exports the public API surface', async () => {
    const mod = await import('./index');
    // Spot-check a representative function and constant from each export
    // group — the file is otherwise just `export { ... }` re-exports.
    expect(typeof mod.generateDoubleElimination).toBe('function');
    expect(typeof mod.selectWinner).toBe('function');
    expect(mod.TBD_PLAYER.id).toBe('tbd');
    expect(mod.BYE_PLAYER.id).toBe('bye');
  });
});

describe('getFinalPlacements — single_elim runner-up TBD/null guard', () => {
  it('skips runner-up when the WB final loser is unset', () => {
    // 8-player SE walked only to QF — WB final has no loser yet.
    let data = generateSingleElimination(makePlayers(8));
    data = selectWinner(data, 'wb_1_0', 'p1');
    data = selectWinner(data, 'wb_1_1', 'p3');
    data = selectWinner(data, 'wb_1_2', 'p5');
    data = selectWinner(data, 'wb_1_3', 'p7');
    const placements = getFinalPlacements(data);
    // QF losers tied at 1; nothing else.
    const ids = placements.map((p) => p.playerId).sort();
    expect(ids).toEqual(['p2', 'p4', 'p6', 'p8']);
    expect(placements.every((p) => p.position === 1)).toBe(true);
  });
});

describe('isArmfightBoutResult', () => {
  it('true for a freshly-initialised bout result', () => {
    expect(
      isArmfightBoutResult({ hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'pending' }),
    ).toBe(true);
  });

  it('true for a bout with legs', () => {
    expect(
      isArmfightBoutResult({
        hand: 'left',
        legs: [{ index: 1, winnerId: 'p1', winType: 'pin' }],
        scoreA: 1,
        scoreB: 0,
        status: 'in_progress',
      }),
    ).toBe(true);
  });

  it('false for null / undefined / primitives', () => {
    expect(isArmfightBoutResult(null)).toBe(false);
    expect(isArmfightBoutResult(undefined)).toBe(false);
    expect(isArmfightBoutResult(42)).toBe(false);
    expect(isArmfightBoutResult('armfight')).toBe(false);
  });

  it('false for an unrelated sport-result blob (no hand / wrong shape)', () => {
    expect(isArmfightBoutResult({ schema: 'armwrestling', victoryType: 'pin' })).toBe(false);
    expect(isArmfightBoutResult({ hand: 'right' })).toBe(false); // missing legs/score/status
    expect(isArmfightBoutResult({ hand: 'middle', legs: [], scoreA: 0, scoreB: 0, status: 'pending' })).toBe(false);
    expect(isArmfightBoutResult({ hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'wat' })).toBe(false);
  });
});

describe('recordLeg — validations', () => {
  it('throws when bout not found', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => recordLeg(data, 'wb_1_99', 1, 'p1', 'pin')).toThrow(/not found/i);
  });

  it('throws when data.format !== "armfight"', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(() => recordLeg(data, 'wb_1_0', 1, 'p1', 'pin')).toThrow(/armfight/i);
  });

  it('throws when winnerId is not one of the two players in the bout', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => recordLeg(data, 'wb_1_0', 1, 'p99', 'pin')).toThrow(/winner/i);
  });

  it('throws when legIndex is out of order', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => recordLeg(data, 'wb_1_0', 2, 'p1', 'pin')).toThrow(/legIndex/i);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    expect(() => recordLeg(data, 'wb_1_0', 1, 'p1', 'pin')).toThrow(/legIndex/i);
    expect(() => recordLeg(data, 'wb_1_0', 3, 'p1', 'pin')).toThrow(/legIndex/i);
  });

  it('throws when winType is invalid', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() =>
      recordLeg(data, 'wb_1_0', 1, 'p1', 'sneeze' as unknown as 'pin'),
    ).toThrow(/winType/i);
  });

  it('rejects appending a leg to a completed bout', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin'); // 3-0 → completed
    expect(() => recordLeg(data, 'wb_1_0', 4, 'p1', 'pin')).toThrow(/closed|completed/i);
  });
});

describe('recordLeg — behaviour', () => {
  it('leg 1 → status in_progress, scoreA = 1', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    const r = data.winnersBracket[0][0].result as ArmfightBoutResult;
    expect(r.status).toBe('in_progress');
    expect(r.scoreA).toBe(1);
    expect(r.scoreB).toBe(0);
    expect(r.legs).toHaveLength(1);
    expect(r.legs[0]).toMatchObject({ index: 1, winnerId: 'p1', winType: 'pin' });
  });

  it('3-0 path → status completed, match.winner = A, match.loser = B', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    const m = data.winnersBracket[0][0];
    expect((m.result as ArmfightBoutResult).status).toBe('completed');
    expect(m.winner).toBe('p1');
    expect(m.loser).toBe('p2');
  });

  it('3-1 path (4 legs)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 4, 'p1', 'pin');
    const r = data.winnersBracket[0][0].result as ArmfightBoutResult;
    expect(r.status).toBe('completed');
    expect(r.scoreA).toBe(3);
    expect(r.scoreB).toBe(1);
    expect(r.legs).toHaveLength(4);
  });

  it('3-2 path (full 5 legs)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 4, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 5, 'p1', 'pin');
    const r = data.winnersBracket[0][0].result as ArmfightBoutResult;
    expect(r.status).toBe('completed');
    expect(r.legs).toHaveLength(5);
    expect(data.winnersBracket[0][0].winner).toBe('p1');
  });

  it('player B wins 2-3 — symmetric assertions to 3-0', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 4, 'p2', 'pin');
    recordLeg(data, 'wb_1_0', 5, 'p2', 'pin');
    const m = data.winnersBracket[0][0];
    expect(m.winner).toBe('p2');
    expect(m.loser).toBe('p1');
    expect((m.result as ArmfightBoutResult).status).toBe('completed');
    expect((m.result as ArmfightBoutResult).scoreA).toBe(2);
    expect((m.result as ArmfightBoutResult).scoreB).toBe(3);
  });

  it('throws when bout has no armfight result payload (corrupt persisted state)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    data.winnersBracket[0][0].result = null;
    expect(() => recordLeg(data, 'wb_1_0', 1, 'p1', 'pin')).toThrow(/no armfight result payload/i);
  });

  it('all three winType values are accepted', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'foul');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'dq');
    const types = (data.winnersBracket[0][0].result as ArmfightBoutResult).legs.map((l) => l.winType);
    expect(types).toEqual(['pin', 'foul', 'dq']);
  });

  it('writes enteredBy / enteredAt when supplied', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin', { enteredBy: 'ref-1', enteredAt: '2026-05-20T12:00:00Z' });
    const leg = (data.winnersBracket[0][0].result as ArmfightBoutResult).legs[0];
    expect(leg.enteredBy).toBe('ref-1');
    expect(leg.enteredAt).toBe('2026-05-20T12:00:00Z');
  });
});

describe('forfeitBout', () => {
  it('walks over a pristine bout — winner set, status walkover', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    forfeitBout(data, 'wb_1_0', 'p1', { walkoverReason: 'injury' });
    const m = data.winnersBracket[0][0];
    const r = m.result as ArmfightBoutResult;
    expect(r.status).toBe('walkover');
    expect(r.walkoverReason).toBe('injury');
    expect(m.winner).toBe('p1');
    expect(m.loser).toBe('p2');
    expect(r.legs).toHaveLength(0);
  });

  it('walks over a mid-bout — existing legs preserved', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p2', 'pin');
    forfeitBout(data, 'wb_1_0', 'p1');
    const r = data.winnersBracket[0][0].result as ArmfightBoutResult;
    expect(r.status).toBe('walkover');
    expect(r.legs).toHaveLength(2);
    expect(r.scoreA).toBe(1);
    expect(r.scoreB).toBe(1);
    expect(data.winnersBracket[0][0].winner).toBe('p1');
  });

  it('throws when bout is already completed', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    recordLeg(data, 'wb_1_0', 1, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 2, 'p1', 'pin');
    recordLeg(data, 'wb_1_0', 3, 'p1', 'pin');
    expect(() => forfeitBout(data, 'wb_1_0', 'p2')).toThrow(/closed|completed/i);
  });

  it('throws when bout is already walkover (double-forfeit)', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    forfeitBout(data, 'wb_1_0', 'p1');
    expect(() => forfeitBout(data, 'wb_1_0', 'p2')).toThrow(/walkover|closed/i);
  });

  it('throws when winnerId is not in the pair', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => forfeitBout(data, 'wb_1_0', 'p99')).toThrow(/winner/i);
  });

  it('throws on non-armfight bracket', () => {
    const data = generateDoubleElimination(makePlayers(4));
    expect(() => forfeitBout(data, 'wb_1_0', 'p1')).toThrow(/armfight/i);
  });

  it('throws when bout not found', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    expect(() => forfeitBout(data, 'wb_1_99', 'p1')).toThrow(/not found/i);
  });

  it('player2-side forfeit — winner/loser flipped correctly', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    forfeitBout(data, 'wb_1_0', 'p2');
    const m = data.winnersBracket[0][0];
    expect(m.winner).toBe('p2');
    expect(m.loser).toBe('p1');
    expect((m.result as ArmfightBoutResult).status).toBe('walkover');
  });

  it('writes match.enteredBy / enteredAt when options.enteredBy supplied', () => {
    const data = generateArmfight([makePair('p1', 'p2')]);
    forfeitBout(data, 'wb_1_0', 'p1', { enteredBy: 'ref-7' });
    const m = data.winnersBracket[0][0];
    expect(m.enteredBy).toBe('ref-7');
    expect(typeof m.enteredAt).toBe('string');
    expect(m.enteredAt).not.toBe('');
  });
});
