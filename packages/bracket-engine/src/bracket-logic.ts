import {
  Player,
  Match,
  GrandFinalMatch,
  SuperFinalMatch,
  BracketData,
  ValidationResult,
  TBD_PLAYER,
  BYE_PLAYER,
} from './types';

// ─── Helpers ────────────────────────────────────────────────

function makeTbd(): Player {
  return { ...TBD_PLAYER };
}

function makeBye(): Player {
  return { ...BYE_PLAYER };
}

function isBye(id: string): boolean {
  return id === 'bye';
}

function isTbd(id: string): boolean {
  return id === 'tbd';
}

function isReal(id: string): boolean {
  return !isBye(id) && !isTbd(id);
}

// ─── Public helpers ─────────────────────────────────────────

export function getPlayerObj(data: BracketData, playerId: string | null): Player {
  if (!playerId || isTbd(playerId)) return makeTbd();
  if (isBye(playerId)) return makeBye();
  const p = data.players.find((pl) => pl.id === playerId);
  if (p) return { ...p };
  return { id: playerId, firstName: '???', lastName: '', number: '?' };
}

export function findMatch(data: BracketData, matchId: string): Match | GrandFinalMatch | null {
  for (const round of data.winnersBracket) {
    for (const match of round) {
      if (match.id === matchId) return match;
    }
  }
  for (const round of data.losersBracket) {
    for (const match of round) {
      if (match.id === matchId) return match;
    }
  }
  if (data.grandFinal.id === matchId) return data.grandFinal;
  if (data.superFinal.id === matchId) return data.superFinal;
  return null;
}

// ─── Bracket-tree traversal ────────────────────────────────

/** Which part of the double-elim tree a match lives in. */
export type BracketSection = 'winners' | 'losers' | 'grand_final' | 'super_final';

/** Callback shape for `walkBracketMatches`. Return `false` to stop early. */
export type BracketMatchVisitor = (
  match: Match | GrandFinalMatch | SuperFinalMatch,
  section: BracketSection,
) => void | boolean;

/**
 * Iterate every match in a bracket in deterministic order:
 *   winners rounds (by round index, then by match index) →
 *   losers rounds (same) → grand final → super final (only when `needed`).
 *
 * Callback may return `false` to stop iteration early (cheap "find first"
 * queries). Any other return value (including `undefined`) continues.
 *
 * Extracted so services / UI don't each hand-roll the same nested `for
 * (round) for (match)` loop — a shape that would need edits in four
 * places every time we add a new bracket section (e.g. consolation
 * final in a future format).
 */
export function walkBracketMatches(data: BracketData, visit: BracketMatchVisitor): void {
  for (const round of data.winnersBracket) {
    for (const m of round) {
      if (visit(m, 'winners') === false) return;
    }
  }
  for (const round of data.losersBracket) {
    for (const m of round) {
      if (visit(m, 'losers') === false) return;
    }
  }
  if (visit(data.grandFinal, 'grand_final') === false) return;
  if (data.superFinal.needed) {
    visit(data.superFinal, 'super_final');
  }
}

/**
 * True iff both athletes in a slot are real (not TBD / BYE) and no winner
 * has been recorded. The "can a result be entered for this match right
 * now?" predicate — used by the operator pending-list and the scheduler.
 */
export function isPlayableMatch(
  match: Match | GrandFinalMatch | SuperFinalMatch,
): boolean {
  if (match.winner) return false;
  const p1 = match.player1?.id;
  const p2 = match.player2?.id;
  return !!(p1 && p2 && isReal(p1) && isReal(p2));
}

// ─── Generate bracket ───────────────────────────────────────

function getWinnerPlayer(match: Match, allPlayers: Player[]): Player {
  if (!match.winner) return makeTbd();
  if (isBye(match.winner)) return makeTbd();
  const player = allPlayers.find((p) => p.id === match.winner);
  if (player) return { ...player };
  if (match.player1 && match.player1.id === match.winner) return { ...match.player1 };
  if (match.player2 && match.player2.id === match.winner) return { ...match.player2 };
  return makeTbd();
}

export function generateDoubleElimination(players: Player[]): BracketData {
  const n = players.length;
  if (n < 2) {
    throw new Error('At least 2 players are required to generate a bracket');
  }

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const numByes = bracketSize - n;

  // Seed players with byes
  const seeded: Player[] = new Array(bracketSize).fill(null);

  const byePositions: number[] = [];
  if (numByes > 0) {
    for (let i = 0; i < numByes; i++) {
      let pos = bracketSize - 1 - i * 2;
      if (pos % 2 === 0) pos--;
      if (pos < 0) pos = 1 + i * 2;
      byePositions.push(pos);
    }
  }

  byePositions.forEach((pos) => {
    seeded[pos] = makeBye();
  });

  let playerIdx = 0;
  for (let i = 0; i < bracketSize; i++) {
    if (!seeded[i] && playerIdx < players.length) {
      seeded[i] = players[playerIdx++];
    } else if (!seeded[i]) {
      seeded[i] = makeBye();
    }
  }

  const wbRounds = Math.ceil(Math.log2(bracketSize));

  // Winners bracket round 1
  const winnersR1: Match[] = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const match: Match = {
      id: `wb_1_${i}`,
      round: 1,
      matchIndex: i,
      player1: { ...seeded[i * 2], seed: i * 2 + 1 },
      player2: { ...seeded[i * 2 + 1], seed: i * 2 + 2 },
      winner: null,
      loser: null,
    };

    // Auto-resolve bye matches
    if (isBye(match.player1.id) && isBye(match.player2.id)) {
      match.winner = 'bye';
      match.loser = 'bye';
    } else if (isBye(match.player1.id)) {
      match.winner = match.player2.id;
      match.loser = 'bye';
    } else if (isBye(match.player2.id)) {
      match.winner = match.player1.id;
      match.loser = 'bye';
    }

    winnersR1.push(match);
  }

  // Build remaining WB rounds
  const winnersBracket: Match[][] = [winnersR1];
  for (let r = 2; r <= wbRounds; r++) {
    const prevRound = winnersBracket[r - 2];
    const roundMatches: Match[] = [];
    for (let i = 0; i < prevRound.length / 2; i++) {
      const feederMatch1 = prevRound[i * 2];
      const feederMatch2 = prevRound[i * 2 + 1];

      const p1 = getWinnerPlayer(feederMatch1, seeded);
      const p2 = getWinnerPlayer(feederMatch2, seeded);

      roundMatches.push({
        id: `wb_${r}_${i}`,
        round: r,
        matchIndex: i,
        player1: p1,
        player2: p2,
        winner: null,
        loser: null,
        feeder1: feederMatch1.id,
        feeder2: feederMatch2.id,
      });
    }
    winnersBracket.push(roundMatches);
  }

  // Losers bracket
  const numLBRounds = (wbRounds - 1) * 2;
  const losersBracket: Match[][] = [];

  for (let r = 1; r <= numLBRounds; r++) {
    const roundMatches: Match[] = [];
    let numMatches: number;

    if (r === 1) {
      numMatches = bracketSize / 4;
    } else if (r % 2 === 0) {
      numMatches = losersBracket[r - 2].length;
    } else {
      numMatches = Math.max(1, losersBracket[r - 2].length / 2);
    }

    numMatches = Math.max(1, Math.floor(numMatches));

    for (let i = 0; i < numMatches; i++) {
      roundMatches.push({
        id: `lb_${r}_${i}`,
        round: r,
        matchIndex: i,
        player1: makeTbd(),
        player2: makeTbd(),
        winner: null,
        loser: null,
        isLosers: true,
      });
    }
    losersBracket.push(roundMatches);
  }

  // Grand Final & Super Final
  const grandFinal: GrandFinalMatch = {
    id: 'grand_final',
    player1: { id: 'tbd', firstName: 'TBD (WB)', lastName: '', number: '?' },
    player2: { id: 'tbd', firstName: 'TBD (LB)', lastName: '', number: '?' },
    winner: null,
    loser: null,
  };

  const superFinal: SuperFinalMatch = {
    id: 'super_final',
    player1: makeTbd(),
    player2: makeTbd(),
    winner: null,
    loser: null,
    needed: false,
  };

  return {
    format: 'double_elim',
    players: players.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      number: p.number,
    })),
    bracketSize,
    wbRounds,
    winnersBracket,
    losersBracket,
    grandFinal,
    superFinal,
    champion: null,
    status: 'active',
  };
}

// ─── Single-elimination ─────────────────────────────────────

/**
 * Build a single-elimination bracket — the same WB shape as
 * `generateDoubleElimination`, but with no losers' side and no grand /
 * super final played. Same `BracketData` shape so every helper
 * (`findMatch`, `walkBracketMatches`, `selectWinner`, `validateResult`,
 * …) just works: `losersBracket: []` flows through the existing guards
 * cleanly, and propagation branches on `format` to declare the WB-final
 * winner the champion.
 *
 * Seeding and bye placement mirror the double-elim algorithm so a
 * tournament organizer who switches formats sees the same first-round
 * pairings.
 */
export function generateSingleElimination(players: Player[]): BracketData {
  const n = players.length;
  if (n < 2) {
    throw new Error('At least 2 players are required to generate a bracket');
  }

  const bracketSize = Math.pow(2, Math.ceil(Math.log2(n)));
  const numByes = bracketSize - n;

  // Bye seeding — same algorithm as `generateDoubleElimination` so that
  // switching formats doesn't shuffle round-1 pairings under the
  // organizer.
  const seeded: Player[] = new Array(bracketSize).fill(null);
  const byePositions: number[] = [];
  if (numByes > 0) {
    for (let i = 0; i < numByes; i++) {
      let pos = bracketSize - 1 - i * 2;
      if (pos % 2 === 0) pos--;
      if (pos < 0) pos = 1 + i * 2;
      byePositions.push(pos);
    }
  }
  byePositions.forEach((pos) => {
    seeded[pos] = makeBye();
  });

  let playerIdx = 0;
  for (let i = 0; i < bracketSize; i++) {
    if (!seeded[i] && playerIdx < players.length) {
      seeded[i] = players[playerIdx++];
    } else if (!seeded[i]) {
      seeded[i] = makeBye();
    }
  }

  const wbRounds = Math.ceil(Math.log2(bracketSize));

  // Round 1
  const winnersR1: Match[] = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const match: Match = {
      id: `wb_1_${i}`,
      round: 1,
      matchIndex: i,
      player1: { ...seeded[i * 2], seed: i * 2 + 1 },
      player2: { ...seeded[i * 2 + 1], seed: i * 2 + 2 },
      winner: null,
      loser: null,
    };

    if (isBye(match.player1.id) && isBye(match.player2.id)) {
      match.winner = 'bye';
      match.loser = 'bye';
    } else if (isBye(match.player1.id)) {
      match.winner = match.player2.id;
      match.loser = 'bye';
    } else if (isBye(match.player2.id)) {
      match.winner = match.player1.id;
      match.loser = 'bye';
    }
    winnersR1.push(match);
  }

  const winnersBracket: Match[][] = [winnersR1];
  for (let r = 2; r <= wbRounds; r++) {
    const prevRound = winnersBracket[r - 2];
    const roundMatches: Match[] = [];
    for (let i = 0; i < prevRound.length / 2; i++) {
      const feederMatch1 = prevRound[i * 2];
      const feederMatch2 = prevRound[i * 2 + 1];

      const p1 = getWinnerPlayer(feederMatch1, seeded);
      const p2 = getWinnerPlayer(feederMatch2, seeded);

      roundMatches.push({
        id: `wb_${r}_${i}`,
        round: r,
        matchIndex: i,
        player1: p1,
        player2: p2,
        winner: null,
        loser: null,
        feeder1: feederMatch1.id,
        feeder2: feederMatch2.id,
      });
    }
    winnersBracket.push(roundMatches);
  }

  // Grand / super final stay TBD-vs-TBD for shape stability. They are
  // never reachable when `format === 'single_elim'` — propagation flips
  // status/champion off the WB final directly.
  const grandFinal: GrandFinalMatch = {
    id: 'grand_final',
    player1: makeTbd(),
    player2: makeTbd(),
    winner: null,
    loser: null,
  };

  const superFinal: SuperFinalMatch = {
    id: 'super_final',
    player1: makeTbd(),
    player2: makeTbd(),
    winner: null,
    loser: null,
    needed: false,
  };

  const result: BracketData = {
    format: 'single_elim',
    players: players.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      number: p.number,
    })),
    bracketSize,
    wbRounds,
    winnersBracket,
    losersBracket: [],
    grandFinal,
    superFinal,
    champion: null,
    status: 'active',
  };

  // Walk-over: if an N=2 bracket is generated where one side is a bye
  // (bracketSize=2, numByes=1), the WB final is auto-resolved so the
  // single real player is already the champion. Rare but real (e.g. a
  // category that ended up with one entry).
  finalizeSingleElim(result);

  return result;
}

/** Shared single-elim "is the WB final done?" check used by the
 *  generator (bye walkover) and by `propagateResults` after each
 *  recordResult. */
function finalizeSingleElim(data: BracketData): void {
  if (data.format !== 'single_elim') return;
  const lastRound = data.winnersBracket[data.winnersBracket.length - 1];
  const final = lastRound?.[0];
  if (!final?.winner) return;
  if (isBye(final.winner)) return;
  data.champion = final.winner;
  data.status = 'completed';
}

// ─── Propagate results ──────────────────────────────────────

function propagateLosers(data: BracketData): void {
  // WB Round 1 losers → LB Round 1
  if (data.winnersBracket[0] && data.losersBracket[0]) {
    const wbR1 = data.winnersBracket[0];
    const lbR1 = data.losersBracket[0];

    for (let i = 0; i < lbR1.length; i++) {
      const loser1 = wbR1[i * 2]?.loser ?? null;
      const loser2 = wbR1[i * 2 + 1]?.loser ?? null;

      if (loser1 && !isBye(loser1)) {
        lbR1[i].player1 = getPlayerObj(data, loser1);
      } else if (loser1 === 'bye') {
        lbR1[i].player1 = makeBye();
      } else {
        lbR1[i].player1 = makeTbd();
      }

      if (loser2 && !isBye(loser2)) {
        lbR1[i].player2 = getPlayerObj(data, loser2);
      } else if (loser2 === 'bye') {
        lbR1[i].player2 = makeBye();
      } else {
        lbR1[i].player2 = makeTbd();
      }

      // Auto-resolve bye matches
      if (isBye(lbR1[i].player1.id) && isReal(lbR1[i].player2.id)) {
        lbR1[i].winner = lbR1[i].player2.id;
        lbR1[i].loser = 'bye';
      } else if (isBye(lbR1[i].player2.id) && isReal(lbR1[i].player1.id)) {
        lbR1[i].winner = lbR1[i].player1.id;
        lbR1[i].loser = 'bye';
      } else if (isBye(lbR1[i].player1.id) && isBye(lbR1[i].player2.id)) {
        lbR1[i].winner = 'bye';
        lbR1[i].loser = 'bye';
      }
    }
  }

  // WB Round 2+ losers → LB even rounds
  for (let wbr = 2; wbr <= data.wbRounds; wbr++) {
    const lbRoundIndex = (wbr - 1) * 2 - 1;
    if (lbRoundIndex >= 0 && lbRoundIndex < data.losersBracket.length) {
      const wbRound = data.winnersBracket[wbr - 1];
      const lbRound = data.losersBracket[lbRoundIndex];

      for (let i = 0; i < lbRound.length && i < wbRound.length; i++) {
        const loser = wbRound[i].loser;
        if (loser && !isBye(loser)) {
          lbRound[i].player2 = getPlayerObj(data, loser);
        } else if (loser === 'bye') {
          lbRound[i].player2 = makeBye();
        }
      }
    }
  }
}

export function propagateResults(data: BracketData): void {
  // Single-elim: WB-only path. The WB final IS the championship match,
  // so we propagate within the WB and shortcut out before any LB/GF/SF
  // logic — `losersBracket` is empty and `grandFinal` stays TBD.
  if (data.format === 'single_elim') {
    for (let r = 1; r < data.winnersBracket.length; r++) {
      const currentRound = data.winnersBracket[r];
      const prevRound = data.winnersBracket[r - 1];

      currentRound.forEach((match, i) => {
        const feeder1 = prevRound[i * 2];
        const feeder2 = prevRound[i * 2 + 1];

        if (feeder1?.winner && !isBye(feeder1.winner)) {
          match.player1 = getPlayerObj(data, feeder1.winner);
        } else if (feeder1?.winner === 'bye') {
          match.player1 = makeBye();
        }
        if (feeder2?.winner && !isBye(feeder2.winner)) {
          match.player2 = getPlayerObj(data, feeder2.winner);
        } else if (feeder2?.winner === 'bye') {
          match.player2 = makeBye();
        }

        if (isBye(match.player1.id) && isReal(match.player2.id)) {
          match.winner = match.player2.id;
          match.loser = 'bye';
        } else if (isBye(match.player2.id) && isReal(match.player1.id)) {
          match.winner = match.player1.id;
          match.loser = 'bye';
        }
      });
    }
    finalizeSingleElim(data);
    return;
  }

  // Propagate winners bracket
  for (let r = 1; r < data.winnersBracket.length; r++) {
    const currentRound = data.winnersBracket[r];
    const prevRound = data.winnersBracket[r - 1];

    currentRound.forEach((match, i) => {
      const feeder1 = prevRound[i * 2];
      const feeder2 = prevRound[i * 2 + 1];

      if (feeder1?.winner && !isBye(feeder1.winner)) {
        match.player1 = getPlayerObj(data, feeder1.winner);
      } else if (feeder1?.winner === 'bye') {
        match.player1 = makeBye();
      }

      if (feeder2?.winner && !isBye(feeder2.winner)) {
        match.player2 = getPlayerObj(data, feeder2.winner);
      } else if (feeder2?.winner === 'bye') {
        match.player2 = makeBye();
      }

      // Auto-resolve bye matches
      if (isBye(match.player1.id) && isReal(match.player2.id)) {
        match.winner = match.player2.id;
        match.loser = 'bye';
      } else if (isBye(match.player2.id) && isReal(match.player1.id)) {
        match.winner = match.player1.id;
        match.loser = 'bye';
      }
    });
  }

  // Feed losers from WB into LB
  propagateLosers(data);

  // Propagate losers bracket
  for (let r = 1; r < data.losersBracket.length; r++) {
    const currentRound = data.losersBracket[r];
    const prevRound = data.losersBracket[r - 1];
    const roundNum = r + 1;

    if (roundNum % 2 === 1 && roundNum > 2) {
      // Merger round: 2 LB winners → 1 match
      currentRound.forEach((match, i) => {
        if (prevRound[i * 2]?.winner && !isTbd(prevRound[i * 2].winner!)) {
          match.player1 = getPlayerObj(data, prevRound[i * 2].winner);
        }
        if (prevRound[i * 2 + 1]?.winner && !isTbd(prevRound[i * 2 + 1].winner!)) {
          match.player2 = getPlayerObj(data, prevRound[i * 2 + 1].winner);
        }
      });
    } else if (roundNum % 2 === 0) {
      // Advancement round: LB winner + WB loser
      currentRound.forEach((match, i) => {
        if (prevRound[i]?.winner && !isTbd(prevRound[i].winner!)) {
          match.player1 = getPlayerObj(data, prevRound[i].winner);
        }
      });
    }

    // Auto-resolve bye matches
    currentRound.forEach((match) => {
      if (isReal(match.player1.id) && isBye(match.player2.id)) {
        match.winner = match.player1.id;
        match.loser = 'bye';
      } else if (isReal(match.player2.id) && isBye(match.player1.id)) {
        match.winner = match.player2.id;
        match.loser = 'bye';
      }
    });
  }

  // Grand Final
  const wbFinal = data.winnersBracket[data.winnersBracket.length - 1][0];
  const lbFinal =
    data.losersBracket.length > 0 ? data.losersBracket[data.losersBracket.length - 1][0] : null;

  if (wbFinal?.winner) {
    data.grandFinal.player1 = getPlayerObj(data, wbFinal.winner);
  }
  if (lbFinal?.winner) {
    data.grandFinal.player2 = getPlayerObj(data, lbFinal.winner);
  }

  // Super Final logic
  if (data.grandFinal.winner) {
    if (data.grandFinal.winner === data.grandFinal.player2.id) {
      // LB player won grand final → super final needed
      data.superFinal.needed = true;
      data.superFinal.player1 = { ...data.grandFinal.player1 };
      data.superFinal.player2 = { ...data.grandFinal.player2 };

      if (data.superFinal.winner) {
        data.champion = data.superFinal.winner;
        data.status = 'completed';
      }
    } else {
      // WB player won → champion, no super final
      data.superFinal.needed = false;
      data.champion = data.grandFinal.winner;
      data.status = 'completed';
    }
  }
}

// ─── Validate result ────────────────────────────────────────

export function validateResult(
  data: BracketData,
  matchId: string,
  winnerId: string,
): ValidationResult {
  const errors: string[] = [];
  const match = findMatch(data, matchId);

  if (!match) {
    return { valid: false, errors: ['Match not found'] };
  }

  if (isTbd(match.player1.id) || isTbd(match.player2.id)) {
    errors.push('Cannot record result: match is not ready yet (TBD players)');
  }
  if (isBye(match.player1.id) || isBye(match.player2.id)) {
    errors.push('Cannot record result: match contains BYE slot');
  }
  if (match.player1.id !== winnerId && match.player2.id !== winnerId) {
    errors.push('Winner must be one of the two players in this match');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Can record result ───────────────────────────────────────

export function canRecordResult(data: BracketData, matchId: string): ValidationResult {
  const errors: string[] = [];
  const match = findMatch(data, matchId);

  if (!match) {
    return { valid: false, errors: ['Match not found'] };
  }

  if (isTbd(match.player1.id) || isTbd(match.player2.id)) {
    errors.push('Previous matches have not been completed yet');
  }
  if (isBye(match.player1.id) && isBye(match.player2.id)) {
    errors.push('Both players are BYE — match auto-resolved');
  }

  return { valid: errors.length === 0, errors };
}

// ─── Reset match ────────────────────────────────────────────

/**
 * Clears the result of a single match and all downstream matches that
 * depended on it, so the bracket is in a valid state for re-entry.
 */
export function resetMatch(data: BracketData, matchId: string): BracketData {
  const match = findMatch(data, matchId);
  if (!match) return data;

  const oldWinner = match.winner;
  const oldLoser = match.loser;

  // Clear the match itself
  match.winner = null;
  match.loser = null;
  match.enteredBy = null;
  match.enteredAt = null;
  match.correctedBy = null;
  match.correctedAt = null;

  // Cascade: clear all downstream matches that received this winner or loser
  _clearDownstream(data, oldWinner, oldLoser);

  return data;
}

function _clearDownstream(
  data: BracketData,
  winnerId: string | null,
  loserId: string | null,
): void {
  const allMatches: (Match | GrandFinalMatch)[] = [
    ...data.winnersBracket.flat(),
    ...data.losersBracket.flat(),
    data.grandFinal,
    data.superFinal,
  ];

  for (const m of allMatches) {
    let touched = false;

    if (winnerId && isReal(winnerId)) {
      if (m.player1.id === winnerId) {
        (m as Match).player1 = { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' };
        touched = true;
      }
      if (m.player2.id === winnerId) {
        (m as Match).player2 = { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' };
        touched = true;
      }
    }
    if (loserId && isReal(loserId)) {
      if (m.player1.id === loserId) {
        (m as Match).player1 = { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' };
        touched = true;
      }
      if (m.player2.id === loserId) {
        (m as Match).player2 = { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' };
        touched = true;
      }
    }

    if (touched && m.winner) {
      const downWinner = m.winner;
      const downLoser = m.loser;
      m.winner = null;
      m.loser = null;
      (m as Match).enteredBy = null;
      (m as Match).enteredAt = null;
      (m as Match).correctedBy = null;
      (m as Match).correctedAt = null;
      _clearDownstream(data, downWinner, downLoser);
    }
  }

  // If grand final players are now incomplete (TBD), finals are no longer valid —
  // clear champion / status / super-final regardless of who the cascaded player was.
  const gfIncomplete = isTbd(data.grandFinal.player1.id) || isTbd(data.grandFinal.player2.id);

  if (gfIncomplete || data.champion === winnerId || data.champion === loserId) {
    data.champion = null;
    data.status = 'active';
    data.grandFinal.winner = null;
    data.grandFinal.loser = null;
    data.grandFinal.enteredBy = null;
    data.grandFinal.enteredAt = null;
    data.grandFinal.correctedBy = null;
    data.grandFinal.correctedAt = null;

    // Reset super final completely — players, flags, audit
    data.superFinal.needed = false;
    data.superFinal.winner = null;
    data.superFinal.loser = null;
    data.superFinal.player1 = { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' };
    data.superFinal.player2 = { id: 'tbd', firstName: 'TBD', lastName: '', number: '?' };
    data.superFinal.enteredBy = null;
    data.superFinal.enteredAt = null;
    data.superFinal.correctedBy = null;
    data.superFinal.correctedAt = null;
  }
}

// ─── Manual edits: replace / withdraw ───────────────────────

/**
 * Replace a real player with another player in a not-yet-played slot.
 * Allowed only when:
 *   - target match exists
 *   - target slot currently holds a real player (not TBD/BYE)
 *   - the match has no recorded winner yet
 *   - the player being replaced has not already won a previous match in this bracket
 *     (this prevents silently altering a propagated result)
 */
export function replacePlayerInSlot(
  data: BracketData,
  matchId: string,
  position: 1 | 2,
  newPlayer: Player,
): { ok: boolean; error?: string } {
  const match = findMatch(data, matchId);
  if (!match) return { ok: false, error: 'Match not found' };
  if (match.winner) return { ok: false, error: 'Match already has a recorded result' };

  const currentSlot = position === 1 ? match.player1 : match.player2;
  if (!isReal(currentSlot.id)) {
    return { ok: false, error: 'Slot does not hold a real player' };
  }

  const oldId = currentSlot.id;

  // Reject if this player has already won a previous match — they propagated
  // into this slot from an earlier win, so "replacing" them here is really
  // a result reset + re-seed, not a simple swap.
  const wonPrior = [
    ...data.winnersBracket.flat(),
    ...data.losersBracket.flat(),
  ].some((m) => m.id !== matchId && m.winner === oldId);
  if (wonPrior) {
    return { ok: false, error: 'Player has already won a prior match; reset results first' };
  }

  if (newPlayer.id === oldId) return { ok: false, error: 'New player is the same as current' };
  if (!isReal(newPlayer.id)) return { ok: false, error: 'New player must be a real player' };

  const replacement: Player = { ...newPlayer };

  if (position === 1) match.player1 = replacement;
  else match.player2 = replacement;

  // Keep data.players in sync: swap out if old player doesn't appear elsewhere,
  // and ensure new player is registered there.
  const oldStillReferenced = [
    ...data.winnersBracket.flat(),
    ...data.losersBracket.flat(),
    data.grandFinal,
    data.superFinal,
  ].some((m) => m.player1.id === oldId || m.player2.id === oldId);

  if (!oldStillReferenced) {
    data.players = data.players.filter((p) => p.id !== oldId);
  }
  if (!data.players.some((p) => p.id === newPlayer.id)) {
    data.players.push({ ...newPlayer });
  }

  return { ok: true };
}

/**
 * Withdraw a player from their current pending match — opponent gets forfeit.
 * Returns the match that was forfeited and the opponent id so the caller can
 * follow up by calling selectWinner(match, opponentId) to propagate.
 *
 * Allowed only when:
 *   - target match exists
 *   - target slot holds a real player
 *   - the match has no recorded winner
 *   - the opponent slot holds a real player (can't forfeit to BYE/TBD)
 */
export function withdrawPlayerFromSlot(
  data: BracketData,
  matchId: string,
  position: 1 | 2,
): { ok: boolean; forfeitTo?: string; error?: string } {
  const match = findMatch(data, matchId);
  if (!match) return { ok: false, error: 'Match not found' };
  if (match.winner) return { ok: false, error: 'Match already has a recorded result' };

  const withdrawnSlot = position === 1 ? match.player1 : match.player2;
  const opponentSlot = position === 1 ? match.player2 : match.player1;

  if (!isReal(withdrawnSlot.id)) {
    return { ok: false, error: 'Slot does not hold a real player' };
  }
  if (!isReal(opponentSlot.id)) {
    return { ok: false, error: 'Opponent is not a real player — no forfeit possible' };
  }

  return { ok: true, forfeitTo: opponentSlot.id };
}

// ─── Select winner ──────────────────────────────────────────

export function selectWinner(
  data: BracketData,
  matchId: string,
  winnerId: string,
  enteredBy?: string,
): BracketData {
  const match = findMatch(data, matchId);
  if (!match) return data;

  const now = new Date().toISOString();
  const isCorrection = !!match.winner;

  match.winner = winnerId;
  if (match.player1.id === winnerId) {
    match.loser = match.player2.id;
  } else {
    match.loser = match.player1.id;
  }

  if (enteredBy) {
    if (isCorrection) {
      match.correctedBy = enteredBy;
      match.correctedAt = now;
    } else {
      match.enteredBy = enteredBy;
      match.enteredAt = now;
    }
  }

  propagateResults(data);
  return data;
}
