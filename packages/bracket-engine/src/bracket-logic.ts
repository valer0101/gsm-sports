import {
  Player,
  Match,
  GrandFinalMatch,
  SuperFinalMatch,
  BracketData,
  ValidationResult,
  Standing,
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

// ─── Round-robin ────────────────────────────────────────────

/**
 * Build a round-robin schedule using the standard "circle method" —
 * every player meets every other player exactly once. For N players
 * the schedule is N-1 rounds (N even) or N rounds with one bye per
 * round (N odd, one player rests each round).
 *
 * Same `BracketData` shape as the elimination formats so consumers
 * (operator UI, scheduler, audit log, …) work without branching:
 *   - `format: 'round_robin'`
 *   - `winnersBracket` carries the rounds, each match is `rr_{round}_{idx}`
 *   - `losersBracket: []`, `grandFinal` / `superFinal` TBD never reached
 *   - Champion is decided by `getRoundRobinStandings` once every match
 *     has a winner; ties at #1 leave `champion: null` and require a
 *     manual tiebreaker (out of scope for this slice).
 */
export function generateRoundRobin(players: Player[]): BracketData {
  const n = players.length;
  if (n < 2) {
    throw new Error('At least 2 players are required to generate a bracket');
  }

  // Circle method needs an even player count. For odd N we add a single
  // synthetic BYE seat — the player paired with BYE in a given round
  // simply rests that round (the match is auto-resolved as a bye-win).
  const work: Player[] = players.slice();
  const oddPad = work.length % 2 === 1;
  if (oddPad) work.push(makeBye());

  const m = work.length; // even
  const numRounds = m - 1;

  // Anchor seat 0 fixed; rotate the rest. Standard circle method.
  const rotation = work.slice(1);

  const rounds: Match[][] = [];
  for (let r = 0; r < numRounds; r++) {
    const roundMatches: Match[] = [];

    // Pair seat 0 with the head of the rotation.
    const slots: Player[] = [work[0], ...rotation];
    for (let i = 0; i < m / 2; i++) {
      const a = slots[i];
      const b = slots[m - 1 - i];

      const match: Match = {
        id: `rr_${r + 1}_${i}`,
        round: r + 1,
        matchIndex: i,
        player1: { ...a, seed: i * 2 + 1 },
        player2: { ...b, seed: i * 2 + 2 },
        winner: null,
        loser: null,
      };

      // Auto-resolve bye matches — no scheduling, no operator click.
      if (isBye(a.id) && isBye(b.id)) {
        match.winner = 'bye';
        match.loser = 'bye';
      } else if (isBye(a.id)) {
        match.winner = b.id;
        match.loser = 'bye';
      } else if (isBye(b.id)) {
        match.winner = a.id;
        match.loser = 'bye';
      }

      roundMatches.push(match);
    }
    rounds.push(roundMatches);

    // Rotate: last → front, others shift up by one.
    rotation.unshift(rotation.pop()!);
  }

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

  const data: BracketData = {
    format: 'round_robin',
    players: players.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      number: p.number,
    })),
    // bracketSize / wbRounds aren't really meaningful for RR; we keep
    // them populated so downstream code that reads them (e.g. the
    // arena UI) doesn't crash. `bracketSize` = real player count;
    // `wbRounds` = number of round-robin rounds.
    bracketSize: n,
    wbRounds: numRounds,
    winnersBracket: rounds,
    losersBracket: [],
    grandFinal,
    superFinal,
    champion: null,
    status: 'active',
  };

  // If the generation already auto-resolved every match (only possible
  // for n=2 with no byes — actually impossible, since n>=2 always has
  // at least one real match — but cheap to call), check for completion.
  finalizeRoundRobin(data);
  return data;
}

/**
 * Compute the standings table for a round-robin bracket. Pure read —
 * walks `winnersBracket`, tallies W-L, and ranks. Bye matches are
 * counted as a win for the real player but don't increment `played`
 * for the bye seat. Ties share `position` (competition ranking — no
 * head-to-head tiebreaker yet).
 *
 * Returns an empty array if `format !== 'round_robin'` so callers
 * don't accidentally generate fake standings for an elimination
 * bracket.
 */
export function getRoundRobinStandings(data: BracketData): Standing[] {
  if (data.format !== 'round_robin') return [];

  const records = new Map<string, { played: number; wins: number; losses: number }>();
  for (const p of data.players) {
    records.set(p.id, { played: 0, wins: 0, losses: 0 });
  }

  for (const round of data.winnersBracket) {
    for (const m of round) {
      if (!m.winner) continue;
      // Skip auto-resolved bye-vs-bye non-events; bye-vs-real counts
      // as a played win for the real player.
      const winnerIsBye = isBye(m.winner);
      const loserIsBye = m.loser ? isBye(m.loser) : true;

      if (!winnerIsBye && records.has(m.winner)) {
        const w = records.get(m.winner)!;
        w.wins += 1;
        w.played += 1;
      }
      if (!loserIsBye && m.loser && records.has(m.loser)) {
        const l = records.get(m.loser)!;
        l.losses += 1;
        l.played += 1;
      }
    }
  }

  const rows = data.players.map((p) => {
    const r = records.get(p.id) ?? { played: 0, wins: 0, losses: 0 };
    return {
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      played: r.played,
      wins: r.wins,
      losses: r.losses,
      position: 0, // assigned below
    };
  });

  // Sort: more wins first, then fewer losses (so a player with a
  // pending match doesn't outrank someone with the same wins but a
  // recorded loss).
  rows.sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  // Competition ranking: tied rows share position; next position skips.
  let pos = 0;
  let lastKey = '';
  rows.forEach((row, idx) => {
    const key = `${row.wins}|${row.losses}`;
    if (key !== lastKey) {
      pos = idx + 1;
      lastKey = key;
    }
    row.position = pos;
  });

  return rows;
}

/**
 * "Are all matches done?" + "is the leader unique?" check. Sets
 * `champion` only when every match has a winner and exactly one
 * player sits at position 1 in the standings; ties at #1 leave
 * `champion: null` and `status: 'active'` so a human can apply a
 * tiebreaker.
 */
function finalizeRoundRobin(data: BracketData): void {
  if (data.format !== 'round_robin') return;

  for (const round of data.winnersBracket) {
    for (const m of round) {
      if (!m.winner) return; // still matches to play
    }
  }

  const standings = getRoundRobinStandings(data);
  if (standings.length === 0) return;
  const leaders = standings.filter((s) => s.position === 1);
  if (leaders.length !== 1) {
    // All matches done but the leader is tied — leave `status: 'active'`
    // so the UI can surface the tie and prompt for a manual decision.
    return;
  }
  data.champion = leaders[0].playerId;
  data.status = 'completed';
}

// ─── Swiss ──────────────────────────────────────────────────

/**
 * Build a Swiss-system bracket. Round 1 is paired immediately by
 * top-half vs bottom-half; rounds 2..N are skeletons whose seats
 * stay TBD-vs-TBD until `propagateResults` populates them after the
 * preceding round completes. Same `BracketData` shape as the other
 * formats — schedule lives in `winnersBracket: Match[][]`.
 *
 * `totalRounds` defaults to `ceil(log2(N))` (the standard Swiss
 * formula — enough rounds to differentiate with high probability).
 * Callers may override for events that want a longer or shorter run.
 *
 * Odd N: one player gets a bye each round. Round 1 byes go to the
 * lowest seed; subsequent rounds, the engine picks the
 * lowest-scored player who hasn't yet had a bye.
 */
export function generateSwiss(players: Player[], totalRounds?: number): BracketData {
  const n = players.length;
  if (n < 2) {
    throw new Error('At least 2 players are required to generate a bracket');
  }

  const rounds = totalRounds ?? Math.max(1, Math.ceil(Math.log2(n)));
  const matchesPerRound = Math.floor(n / 2);
  const oddPlayer = n % 2 === 1;

  // Round 1: top-half vs bottom-half pairing. For odd N the middle
  // seed (the highest-numbered seed in the lower half, treated as the
  // lowest-rated of the field) takes the bye.
  const half = Math.floor(n / 2);
  const round1Matches: Match[] = [];
  for (let i = 0; i < half; i++) {
    const a = players[i];
    const b = players[half + i];
    round1Matches.push({
      id: `sw_1_${i}`,
      round: 1,
      matchIndex: i,
      player1: { ...a, seed: i + 1 },
      player2: { ...b, seed: half + i + 1 },
      winner: null,
      loser: null,
    });
  }

  if (oddPlayer) {
    // The leftover real player (last seed) gets the round-1 bye.
    const byePlayer = players[n - 1];
    round1Matches.push({
      id: `sw_1_${matchesPerRound}`,
      round: 1,
      matchIndex: matchesPerRound,
      player1: { ...byePlayer, seed: n },
      player2: makeBye(),
      winner: byePlayer.id,
      loser: 'bye',
    });
  }

  // Rounds 2..N: empty skeletons, seats TBD until we pair them.
  const slotsPerRound = oddPlayer ? matchesPerRound + 1 : matchesPerRound;
  const winnersBracket: Match[][] = [round1Matches];
  for (let r = 2; r <= rounds; r++) {
    const round: Match[] = [];
    for (let i = 0; i < slotsPerRound; i++) {
      round.push({
        id: `sw_${r}_${i}`,
        round: r,
        matchIndex: i,
        player1: makeTbd(),
        player2: makeTbd(),
        winner: null,
        loser: null,
      });
    }
    winnersBracket.push(round);
  }

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

  const data: BracketData = {
    format: 'swiss',
    players: players.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      number: p.number,
    })),
    bracketSize: n,
    wbRounds: rounds,
    winnersBracket,
    losersBracket: [],
    grandFinal,
    superFinal,
    champion: null,
    status: 'active',
  };

  // For N=1 (rejected above) or pathological cases the round-1 result
  // might already be enough; finalize defensively.
  finalizeSwiss(data);
  return data;
}

/**
 * Compute Swiss standings the same way as round-robin (wins desc,
 * losses asc, competition ranking). MVP — no Buchholz / Sonneborn-
 * Berger tiebreaker yet; tied rows share a position.
 */
export function getSwissStandings(data: BracketData): Standing[] {
  if (data.format !== 'swiss') return [];

  const records = new Map<string, { played: number; wins: number; losses: number }>();
  for (const p of data.players) {
    records.set(p.id, { played: 0, wins: 0, losses: 0 });
  }

  for (const round of data.winnersBracket) {
    for (const m of round) {
      if (!m.winner) continue;
      const winnerIsBye = isBye(m.winner);
      const loserIsBye = m.loser ? isBye(m.loser) : true;

      if (!winnerIsBye && records.has(m.winner)) {
        const w = records.get(m.winner)!;
        w.wins += 1;
        w.played += 1;
      }
      if (!loserIsBye && m.loser && records.has(m.loser)) {
        const l = records.get(m.loser)!;
        l.losses += 1;
        l.played += 1;
      }
    }
  }

  const rows = data.players.map((p) => {
    const r = records.get(p.id) ?? { played: 0, wins: 0, losses: 0 };
    return {
      playerId: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      played: r.played,
      wins: r.wins,
      losses: r.losses,
      position: 0,
    };
  });

  rows.sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  let pos = 0;
  let lastKey = '';
  rows.forEach((row, idx) => {
    const key = `${row.wins}|${row.losses}`;
    if (key !== lastKey) {
      pos = idx + 1;
      lastKey = key;
    }
    row.position = pos;
  });

  return rows;
}

/** Set of "playerA|playerB" keys for every pair that's already met. */
function priorPairs(data: BracketData): Set<string> {
  const pairs = new Set<string>();
  for (const round of data.winnersBracket) {
    for (const m of round) {
      // Only count rounds with real seats — skeleton TBD rows don't
      // represent a played pairing.
      if (isTbd(m.player1.id) || isTbd(m.player2.id)) continue;
      if (isBye(m.player1.id) || isBye(m.player2.id)) continue;
      pairs.add(pairKey(m.player1.id, m.player2.id));
    }
  }
  return pairs;
}

/** IDs of players who have already received a bye in any prior round. */
function priorByes(data: BracketData): Set<string> {
  const byes = new Set<string>();
  for (const round of data.winnersBracket) {
    for (const m of round) {
      if (isBye(m.player2.id) && isReal(m.player1.id)) byes.add(m.player1.id);
      if (isBye(m.player1.id) && isReal(m.player2.id)) byes.add(m.player2.id);
    }
  }
  return byes;
}

function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/**
 * Pair the next Swiss round when the previous one has completed.
 * Sorts by current score, greedily pairs adjacent, skipping rematches
 * when possible. Falls back to the first available opponent if the
 * top of the standings has played everyone left (pathological — only
 * possible with very small N relative to round count).
 *
 * Mutates `data.winnersBracket[roundIdx]` in place.
 */
function pairSwissRound(data: BracketData, roundIdx: number): void {
  const round = data.winnersBracket[roundIdx];
  if (!round || round.length === 0) return;

  const standings = getSwissStandings(data);
  const played = priorPairs(data);
  const byesGiven = priorByes(data);

  // Order: by standings position first; for new players (round 1
  // tie-bust where no one has played yet), fall back to bracket
  // seed order which mirrors `data.players`.
  const seedOrder = new Map(data.players.map((p, i) => [p.id, i]));
  const sortedIds = standings
    .slice()
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (a.losses !== b.losses) return a.losses - b.losses;
      return (seedOrder.get(a.playerId) ?? 0) - (seedOrder.get(b.playerId) ?? 0);
    })
    .map((s) => s.playerId);

  let remaining = sortedIds.slice();
  const matches: Array<{ p1: string; p2: string }> = [];
  let byeAssignee: string | null = null;

  // Odd N → bye goes to the lowest-scored player who hasn't yet had
  // one. If everyone's already had a bye, fall back to the absolute
  // lowest-scored player.
  if (remaining.length % 2 === 1) {
    const candidates = remaining.slice().reverse(); // worst score first
    byeAssignee = candidates.find((id) => !byesGiven.has(id)) ?? candidates[0];
    remaining = remaining.filter((id) => id !== byeAssignee);
  }

  while (remaining.length > 0) {
    const p1 = remaining.shift()!;
    let p2Idx = remaining.findIndex((id) => !played.has(pairKey(p1, id)));
    if (p2Idx === -1) p2Idx = 0; // forced rematch — first available
    const p2 = remaining.splice(p2Idx, 1)[0];
    matches.push({ p1, p2 });
  }

  // Write into the skeleton seats. matchesPerRound real matches first;
  // bye match (if any) takes the last slot.
  matches.forEach((m, i) => {
    const slot = round[i];
    if (!slot) return;
    slot.player1 = getPlayerObj(data, m.p1);
    slot.player2 = getPlayerObj(data, m.p2);
    slot.winner = null;
    slot.loser = null;
  });

  if (byeAssignee !== null) {
    const slot = round[matches.length];
    if (slot) {
      slot.player1 = getPlayerObj(data, byeAssignee);
      slot.player2 = makeBye();
      slot.winner = byeAssignee;
      slot.loser = 'bye';
    }
  }
}

/**
 * After each `selectWinner`, advance Swiss state:
 *   - if every round is complete, finalize champion
 *   - else if the current round just completed, populate the next
 *     round's skeleton via `pairSwissRound`
 */
function finalizeSwiss(data: BracketData): void {
  if (data.format !== 'swiss') return;

  // Find the lowest-index round that still has open matches.
  let openRoundIdx = -1;
  for (let r = 0; r < data.winnersBracket.length; r++) {
    const round = data.winnersBracket[r];
    if (round.some((m) => !m.winner)) {
      openRoundIdx = r;
      break;
    }
  }

  if (openRoundIdx === -1) {
    // Every round complete — assign champion if uniquely on top.
    const standings = getSwissStandings(data);
    if (standings.length === 0) return;
    const leaders = standings.filter((s) => s.position === 1);
    if (leaders.length !== 1) return;
    data.champion = leaders[0].playerId;
    data.status = 'completed';
    return;
  }

  // If the current open round still has TBD seats AND the previous
  // round is complete, that's our cue to pair this round now.
  const round = data.winnersBracket[openRoundIdx];
  const hasTbdSeat = round.some(
    (m) => isTbd(m.player1.id) && isTbd(m.player2.id),
  );
  if (!hasTbdSeat) return; // round already paired, just waiting for winners
  if (openRoundIdx === 0) return; // round 1 is paired at generation time

  const prev = data.winnersBracket[openRoundIdx - 1];
  const prevDone = prev.every((m) => m.winner);
  if (!prevDone) return;

  pairSwissRound(data, openRoundIdx);
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
  // Round-robin: every match is independent (no winners/losers
  // propagating into next-round seats). Just check whether the
  // tournament is complete and a unique leader has emerged.
  if (data.format === 'round_robin') {
    finalizeRoundRobin(data);
    return;
  }

  // Swiss: when the current round completes, pair the next one based
  // on standings + prior-pair history. Champion when all rounds done
  // and a unique leader emerges.
  if (data.format === 'swiss') {
    finalizeSwiss(data);
    return;
  }

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

  // Round-robin: every match is independent — no propagation, no
  // downstream cascade. We just clear `champion` / `status` if the
  // bracket was previously completed and recompute via the same
  // finalize check.
  if (data.format === 'round_robin') {
    if (data.champion === oldWinner) {
      data.champion = null;
      data.status = 'active';
    }
    finalizeRoundRobin(data);
    return data;
  }

  // Swiss: clearing a result invalidates the pairings of every
  // subsequent round (they depend on the score going into them). Wipe
  // those rounds back to TBD skeletons; finalize will re-pair the
  // current round once the affected match's winner is re-entered.
  if (data.format === 'swiss') {
    if (data.champion === oldWinner) {
      data.champion = null;
      data.status = 'active';
    }
    const resetIdx = data.winnersBracket.findIndex((round) =>
      round.some((m) => m.id === matchId),
    );
    if (resetIdx >= 0) {
      for (let r = resetIdx + 1; r < data.winnersBracket.length; r++) {
        for (const slot of data.winnersBracket[r]) {
          slot.player1 = makeTbd();
          slot.player2 = makeTbd();
          slot.winner = null;
          slot.loser = null;
          slot.enteredBy = null;
          slot.enteredAt = null;
          slot.correctedBy = null;
          slot.correctedAt = null;
        }
      }
    }
    finalizeSwiss(data);
    return data;
  }

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
