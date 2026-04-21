import { describe, it, expect } from 'vitest';
import {
  generateDoubleElimination,
  selectWinner,
  findMatch,
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
