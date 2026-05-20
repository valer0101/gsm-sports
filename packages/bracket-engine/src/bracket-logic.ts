import {
  Player,
  Match,
  GrandFinalMatch,
  SuperFinalMatch,
  BracketData,
  ValidationResult,
  Standing,
  FinalPlacement,
  GroupStage,
  ArmfightPairSpec,
  ArmfightBoutResult,
  ArmfightHand,
  LegWinType,
  RecordLegOptions,
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
  // Phase 3.3d — group-stage matches live outside winnersBracket.
  for (const group of data.groups ?? []) {
    for (const round of group.rounds) {
      for (const match of round) {
        if (match.id === matchId) return match;
      }
    }
  }
  if (data.grandFinal.id === matchId) return data.grandFinal;
  if (data.superFinal.id === matchId) return data.superFinal;
  return null;
}

// ─── Bracket-tree traversal ────────────────────────────────

/**
 * Which part of the bracket tree a match lives in. `group_stage` was
 * added in Phase 3.3d for `groups_playoff` — those matches live in
 * `data.groups[*].rounds`, not in `winnersBracket`.
 */
export type BracketSection =
  | 'winners'
  | 'losers'
  | 'grand_final'
  | 'super_final'
  | 'group_stage';

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
  // Group-stage matches first — they're chronologically before any
  // playoff matches that share `winnersBracket` for groups_playoff.
  for (const group of data.groups ?? []) {
    for (const round of group.rounds) {
      for (const m of round) {
        if (visit(m, 'group_stage') === false) return;
      }
    }
  }
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

// ─── Armfight (fight card — sub-project B) ──────────────────

function freshBoutResult(hand: ArmfightHand): ArmfightBoutResult {
  return {
    hand,
    legs: [],
    scoreA: 0,
    scoreB: 0,
    status: 'pending',
  };
}

/**
 * Build an armfight fight card — 1..N independent bouts, each best-of-5 on a
 * single hand. Admin curates the pair list (no auto-pairing). Each bout is a
 * regular `Match` in `winnersBracket[0]`; bo5 score lives in `Match.result`
 * as an `ArmfightBoutResult`. `champion` is always null — a fight card has
 * no event-level winner (decisions §2.1 of the spec).
 *
 * Throws on: empty pairs; self-pair; BYE/TBD in a pair; a player appearing
 * in two pairs; invalid hand.
 */
export function generateArmfight(pairs: ArmfightPairSpec[]): BracketData {
  if (!pairs || pairs.length === 0) {
    throw new Error('generateArmfight: at least one pair is required');
  }

  const seenPlayerIds = new Set<string>();
  pairs.forEach((p, idx) => {
    if (!p.playerA?.id || !p.playerB?.id) {
      throw new Error(`generateArmfight: pair[${idx}] is missing a player`);
    }
    if (p.playerA.id === p.playerB.id) {
      throw new Error(`generateArmfight: pair[${idx}] has the same player on both sides`);
    }
    if (isBye(p.playerA.id) || isTbd(p.playerA.id) || isBye(p.playerB.id) || isTbd(p.playerB.id)) {
      throw new Error(`generateArmfight: pair[${idx}] contains a BYE/TBD slot`);
    }
    if (p.hand !== 'left' && p.hand !== 'right') {
      throw new Error(`generateArmfight: pair[${idx}] has invalid hand '${String(p.hand)}'`);
    }
    if (seenPlayerIds.has(p.playerA.id)) {
      throw new Error(`generateArmfight: player '${p.playerA.id}' appears in two pairs (duplicate)`);
    }
    if (seenPlayerIds.has(p.playerB.id)) {
      throw new Error(`generateArmfight: player '${p.playerB.id}' appears in two pairs (duplicate)`);
    }
    seenPlayerIds.add(p.playerA.id);
    seenPlayerIds.add(p.playerB.id);
  });

  const matches: Match[] = pairs.map((p, i) => ({
    id: `wb_1_${i}`,
    round: 1,
    matchIndex: i,
    player1: { ...p.playerA, seed: i * 2 + 1 },
    player2: { ...p.playerB, seed: i * 2 + 2 },
    winner: null,
    loser: null,
    result: freshBoutResult(p.hand),
  }));

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

  const players: Player[] = [];
  const seenInOutput = new Set<string>();
  for (const p of pairs) {
    for (const pl of [p.playerA, p.playerB]) {
      if (!seenInOutput.has(pl.id)) {
        seenInOutput.add(pl.id);
        players.push({ id: pl.id, firstName: pl.firstName, lastName: pl.lastName, number: pl.number });
      }
    }
  }

  return {
    format: 'armfight',
    players,
    bracketSize: pairs.length * 2,
    wbRounds: 1,
    winnersBracket: [matches],
    losersBracket: [],
    grandFinal,
    superFinal,
    champion: null,
    status: 'active',
  };
}

/**
 * Finalize an armfight card — bracket completes when every bout is
 * `completed` or `walkover`. `champion` always stays null.
 */
function finalizeArmfight(data: BracketData): void {
  if (data.format !== 'armfight') return;
  const round = data.winnersBracket[0] ?? [];
  const allDone = round.every((m) => {
    const r = m.result as ArmfightBoutResult | null | undefined;
    return r?.status === 'completed' || r?.status === 'walkover';
  });
  if (allDone && round.length > 0) data.status = 'completed';
  // champion intentionally not set — fight card has no event-level champion.
}

const HANDS = new Set<string>(['left', 'right']);
const STATUSES = new Set<string>(['pending', 'in_progress', 'completed', 'walkover']);

/** Narrows an unknown blob to an `ArmfightBoutResult`. Pure / no mutation. */
export function isArmfightBoutResult(x: unknown): x is ArmfightBoutResult {
  if (!x || typeof x !== 'object') return false;
  const r = x as Record<string, unknown>;
  if (typeof r.hand !== 'string' || !HANDS.has(r.hand)) return false;
  if (!Array.isArray(r.legs)) return false;
  if (typeof r.scoreA !== 'number' || typeof r.scoreB !== 'number') return false;
  if (typeof r.status !== 'string' || !STATUSES.has(r.status)) return false;
  return true;
}

const WIN_TYPES = new Set<string>(['pin', 'foul', 'dq']);

/**
 * Append a leg result to a pending / in_progress armfight bout. Mutates
 * `data` in place. Decides the bout when a side reaches 3 leg wins —
 * sets match.winner/loser and result.status accordingly.
 *
 * Throws on (in implementation order):
 *   - data.format !== 'armfight'
 *   - bout not found by id
 *   - bout has no armfight result payload (corrupt persisted state)
 *   - bout already completed or walkover
 *   - winnerId not in {player1.id, player2.id}
 *   - winType not in {'pin','foul','dq'}
 *   - legIndex outside 1..5
 *   - legIndex !== legs.length + 1 (must be the next leg in sequence)
 */
export function recordLeg(
  data: BracketData,
  boutId: string,
  legIndex: number,
  winnerId: string,
  winType: LegWinType,
  options?: RecordLegOptions,
): void {
  if (data.format !== 'armfight') {
    throw new Error('recordLeg: only valid on armfight brackets');
  }
  const match = (data.winnersBracket[0] ?? []).find((m) => m.id === boutId);
  if (!match) throw new Error(`recordLeg: bout '${boutId}' not found`);

  const r = match.result as ArmfightBoutResult | null | undefined;
  if (!isArmfightBoutResult(r)) {
    throw new Error(`recordLeg: bout '${boutId}' has no armfight result payload`);
  }
  if (r.status === 'completed' || r.status === 'walkover') {
    throw new Error(`recordLeg: bout '${boutId}' is closed (status=${r.status})`);
  }
  if (winnerId !== match.player1.id && winnerId !== match.player2.id) {
    throw new Error(`recordLeg: winnerId '${winnerId}' is not a player in this bout`);
  }
  if (!WIN_TYPES.has(winType)) {
    throw new Error(`recordLeg: invalid winType '${String(winType)}'`);
  }
  // Bare-bounds check first so a caller passing legIndex=6 with an
  // empty legs[] gets a clear "out of range" error, not the misleading
  // "out of order (expected 1)" the next check would produce.
  if (legIndex < 1 || legIndex > 5) {
    throw new Error(`recordLeg: legIndex ${legIndex} outside bo5 range 1..5`);
  }
  if (legIndex !== r.legs.length + 1) {
    throw new Error(`recordLeg: legIndex ${legIndex} is out of order (expected ${r.legs.length + 1})`);
  }

  r.legs.push({
    index: legIndex,
    winnerId,
    winType,
    enteredBy: options?.enteredBy ?? null,
    enteredAt: options?.enteredAt ?? new Date().toISOString(),
  });
  if (winnerId === match.player1.id) r.scoreA += 1;
  else r.scoreB += 1;

  if (r.scoreA === 3 || r.scoreB === 3) {
    r.status = 'completed';
    match.winner = r.scoreA === 3 ? match.player1.id : match.player2.id;
    match.loser = r.scoreA === 3 ? match.player2.id : match.player1.id;
  } else {
    r.status = 'in_progress';
  }
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

  // Sort: more wins first, then more matches played (so a player who
  // hasn't played any matches doesn't outrank someone with the same
  // wins but recorded losses — phantom mid-tournament rankings),
  // then fewer losses as final tiebreaker.
  rows.sort(
    (a, b) =>
      b.wins - a.wins || b.played - a.played || a.losses - b.losses,
  );

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

  // Same three-term sort as `getRoundRobinStandings` — `played desc`
  // before `losses asc` so a player who hasn't played yet doesn't
  // outrank someone with the same wins but a recorded loss
  // ("phantom mid-tournament rankings", see #56).
  rows.sort(
    (a, b) =>
      b.wins - a.wins || b.played - a.played || a.losses - b.losses,
  );

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

/**
 * Per-player count of byes already received across all prior rounds.
 * Returned as a `Map` rather than a `Set` so the bye-assignment logic
 * can rank "fewest prior byes" rather than just "any prior bye" —
 * matters in long Swiss tournaments where rounds > N (the corner
 * case where a `Set` fallback could silently double-bye the same
 * player while others have one).
 */
function priorByes(data: BracketData): Map<string, number> {
  const byes = new Map<string, number>();
  for (const round of data.winnersBracket) {
    for (const m of round) {
      if (isBye(m.player2.id) && isReal(m.player1.id)) {
        byes.set(m.player1.id, (byes.get(m.player1.id) ?? 0) + 1);
      }
      if (isBye(m.player1.id) && isReal(m.player2.id)) {
        byes.set(m.player2.id, (byes.get(m.player2.id) ?? 0) + 1);
      }
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

  // Odd N → bye goes to the player with the fewest prior byes (avoids
  // double-byeing the same person in long Swiss where rounds > N), and
  // among those tied, the lowest-scored. Without the count tiebreaker
  // a `Set`-based "any prior bye" fallback would silently give the
  // same player a second bye while others have one.
  if (remaining.length % 2 === 1) {
    const candidates = remaining.slice().reverse(); // worst score first
    let bestId = candidates[0];
    let bestByes = byesGiven.get(bestId) ?? 0;
    for (const id of candidates) {
      const count = byesGiven.get(id) ?? 0;
      if (count < bestByes) {
        bestId = id;
        bestByes = count;
      }
    }
    byeAssignee = bestId;
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

// ─── Groups + Playoff ──────────────────────────────────────

/**
 * Snake-seed N players into K groups so every group has comparable
 * strength. With seeds 1..N, group A gets seeds 1, 2K, 2K+1, 4K, 4K+1, …
 * — i.e. the standard serpentine pattern used in football and chess
 * group draws. Returns one bucket per group.
 */
function snakeSeedGroups<T>(items: T[], groupCount: number): T[][] {
  const groups: T[][] = Array.from({ length: groupCount }, () => []);
  let idx = 0;
  let direction = 1;
  for (const it of items) {
    groups[idx].push(it);
    if (direction === 1 && idx === groupCount - 1) {
      direction = -1;
    } else if (direction === -1 && idx === 0) {
      direction = 1;
    } else {
      idx += direction;
    }
  }
  return groups;
}

/**
 * Build the round-robin schedule for a single group. Mirrors
 * `generateRoundRobin` but with `gp_{name}_*` ids and without the
 * outer `BracketData` wrapper — the caller owns the wrapper for
 * `groups_playoff`.
 */
function buildGroupRoundRobin(name: string, players: Player[]): Match[][] {
  if (players.length < 2) {
    // A 1-player group is a walkover — return a single round with a
    // single bye match the caller will treat as auto-resolved.
    return [
      [
        {
          id: `gp_${name}_1_0`,
          round: 1,
          matchIndex: 0,
          player1: { ...players[0], seed: 1 },
          player2: makeBye(),
          winner: players[0]?.id ?? null,
          loser: 'bye',
        },
      ],
    ];
  }

  const work: Player[] = players.slice();
  const oddPad = work.length % 2 === 1;
  if (oddPad) work.push(makeBye());

  const m = work.length;
  const numRounds = m - 1;
  const rotation = work.slice(1);

  const rounds: Match[][] = [];
  for (let r = 0; r < numRounds; r++) {
    const roundMatches: Match[] = [];
    const slots: Player[] = [work[0], ...rotation];
    for (let i = 0; i < m / 2; i++) {
      const a = slots[i];
      const b = slots[m - 1 - i];

      const match: Match = {
        id: `gp_${name}_${r + 1}_${i}`,
        round: r + 1,
        matchIndex: i,
        player1: { ...a, seed: i * 2 + 1 },
        player2: { ...b, seed: i * 2 + 2 },
        winner: null,
        loser: null,
      };

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
    rotation.unshift(rotation.pop()!);
  }
  return rounds;
}

/**
 * Round-robin standings for one group of a `groups_playoff` bracket.
 * Same shape as `getRoundRobinStandings` but scoped to a single
 * `GroupStage`. Returns an empty array when the group can't be
 * found.
 */
export function getGroupStandings(data: BracketData, groupName: string): Standing[] {
  if (data.format !== 'groups_playoff') return [];
  const group = (data.groups ?? []).find((g) => g.name === groupName);
  if (!group) return [];

  const records = new Map<string, { played: number; wins: number; losses: number }>();
  for (const p of group.players) {
    records.set(p.id, { played: 0, wins: 0, losses: 0 });
  }

  for (const round of group.rounds) {
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

  const rows = group.players.map((p) => {
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

  // Same three-term sort as `getRoundRobinStandings` — `played desc`
  // before `losses asc` so a player who hasn't played yet doesn't
  // outrank someone with the same wins but a recorded loss
  // ("phantom mid-tournament rankings", see #56).
  rows.sort(
    (a, b) =>
      b.wins - a.wins || b.played - a.played || a.losses - b.losses,
  );

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

// ─── Final placements (Phase 3.4) ───────────────────────────

/**
 * Compute final placements for a single bracket — a unified cross-
 * format API for the team-standings aggregator. `position` is 1-based
 * competition ranking (ties share a position). Bye / TBD seats are
 * filtered out; only real player ids appear.
 *
 * Behaviour per format:
 *   - `round_robin` / `swiss` — forwards `getRoundRobinStandings` /
 *     `getSwissStandings` positions verbatim. Mid-tournament rows are
 *     ranked by current W-L (same competition-ranking sort the
 *     standings table uses), so partial results yield partial rows.
 *   - `single_elim` — champion = 1; runner-up = 2 (loser of the WB
 *     final); then losers of each preceding round form a tied tier.
 *     Tier size = number of *real* losses in that round (so byes don't
 *     inflate or skip positions when the field doesn't fill the
 *     bracket).
 *   - `double_elim` — champion = 1; runner-up = 2 (loser of GF, or of
 *     SF when `superFinal.needed`); then LB rounds last→first form
 *     successive tiers (LB-final loser = 3rd, LB-prev loser = 4th, …).
 *   - `groups_playoff` — placements are read off the single-elim
 *     playoff (in `winnersBracket`). Group-stage non-advancers are NOT
 *     placed — they're simply omitted. This keeps the API honest:
 *     team scoring schemes typically award points only to top 3-4
 *     finishers, all of whom are guaranteed to be playoff finishers.
 *
 * Best-effort partial: if the bracket isn't finished, only players
 * whose position is determined (champion + every recorded loser) are
 * returned. Players still alive in an elimination bracket are omitted
 * — their final rank isn't known yet.
 */
export function getFinalPlacements(data: BracketData): FinalPlacement[] {
  const format = data.format ?? 'double_elim';
  switch (format) {
    case 'round_robin':
      return getRoundRobinStandings(data).map((s) => ({
        playerId: s.playerId,
        position: s.position,
      }));
    case 'swiss':
      return getSwissStandings(data).map((s) => ({
        playerId: s.playerId,
        position: s.position,
      }));
    case 'single_elim':
      return placementsFromEliminationRounds(data, data.winnersBracket, {
        champion: data.champion,
        runnerUpFinder: () => {
          // Loser of the last WB round (the WB final).
          const finalRound = data.winnersBracket[data.winnersBracket.length - 1];
          if (!finalRound || finalRound.length === 0) return null;
          const finalMatch = finalRound[0];
          if (!finalMatch || !finalMatch.loser) return null;
          if (!isReal(finalMatch.loser)) return null;
          return finalMatch.loser;
        },
        // For SE the WB-final loser is also picked up by the loser-walk
        // below; we'd double-count without skipping that match.
        skipLastRoundLoserDuringWalk: true,
      });
    case 'double_elim':
      return placementsFromEliminationRounds(data, data.losersBracket, {
        champion: data.champion,
        runnerUpFinder: () => getDoubleElimRunnerUp(data),
        skipLastRoundLoserDuringWalk: false,
      });
    case 'groups_playoff':
      // Playoff is single-elim-shaped. Group-stage non-advancers are
      // intentionally excluded (see docstring).
      return placementsFromEliminationRounds(data, data.winnersBracket, {
        champion: data.champion,
        runnerUpFinder: () => {
          const finalRound = data.winnersBracket[data.winnersBracket.length - 1];
          if (!finalRound || finalRound.length === 0) return null;
          const finalMatch = finalRound[0];
          if (!finalMatch || !finalMatch.loser) return null;
          if (!isReal(finalMatch.loser)) return null;
          return finalMatch.loser;
        },
        skipLastRoundLoserDuringWalk: true,
      });
    case 'armfight': {
      // One match: champion = winner, runner-up = loser. Either or both
      // may be null while the bout is still pending.
      const out: FinalPlacement[] = [];
      const match = data.winnersBracket[0]?.[0];
      if (data.champion && isReal(data.champion)) {
        out.push({ playerId: data.champion, position: 1 });
      }
      if (match?.loser && isReal(match.loser)) {
        out.push({ playerId: match.loser, position: out.length + 1 });
      }
      return out;
    }
    default: {
      const exhaustive: never = format;
      void exhaustive;
      return [];
    }
  }
}

/**
 * Shared placement walker for elimination formats. Walks the supplied
 * loser-tree rounds last→first; each round's distinct real losers form
 * one tied tier whose position is `1 + (players already placed above)`.
 *
 * For SE/groups_playoff the walked tree IS the WB (the final's loser
 * is the runner-up — pulled out separately), so we skip the very last
 * match's loser to avoid double-counting. For DE the walked tree is
 * the LB and the GF/SF loser is the runner-up, so no skip.
 */
function placementsFromEliminationRounds(
  data: BracketData,
  rounds: Match[][],
  opts: {
    champion: string | null;
    runnerUpFinder: () => string | null;
    skipLastRoundLoserDuringWalk: boolean;
  },
): FinalPlacement[] {
  const out: FinalPlacement[] = [];
  let nextPos = 1;

  if (opts.champion && isReal(opts.champion)) {
    out.push({ playerId: opts.champion, position: nextPos });
    nextPos += 1;
  }

  const runnerUp = opts.runnerUpFinder();
  if (runnerUp && isReal(runnerUp)) {
    out.push({ playerId: runnerUp, position: nextPos });
    nextPos += 1;
  }

  if (rounds.length === 0) return out;

  const lastRoundIdx = rounds.length - 1;
  for (let r = lastRoundIdx; r >= 0; r--) {
    const round = rounds[r];
    const isLastRound = r === lastRoundIdx;

    const losers: string[] = [];
    for (let i = 0; i < round.length; i++) {
      const m = round[i];
      // Skip the WB-final match for SE/groups_playoff — its loser is
      // the runner-up, already placed.
      if (opts.skipLastRoundLoserDuringWalk && isLastRound && i === 0) continue;
      if (!m.loser) continue;
      if (!isReal(m.loser)) continue;
      // Defensive: skip TBD-vs-TBD seats that somehow have a loser id.
      if (isTbd(m.player1.id) && isTbd(m.player2.id)) continue;
      losers.push(m.loser);
    }

    if (losers.length === 0) continue;

    for (const playerId of losers) {
      out.push({ playerId, position: nextPos });
    }
    nextPos += losers.length;
  }

  return out;
}

/**
 * Determine the runner-up of a double-elim bracket — i.e. who lost the
 * match that decided the championship. SF takes precedence over GF
 * when `superFinal.needed` is true (because the WB winner forced a
 * reset by losing GF, so the SF is the real decider).
 */
function getDoubleElimRunnerUp(data: BracketData): string | null {
  if (data.superFinal?.needed) {
    if (data.superFinal.winner && data.superFinal.loser && isReal(data.superFinal.loser)) {
      return data.superFinal.loser;
    }
    return null;
  }
  if (data.grandFinal.winner && data.grandFinal.loser && isReal(data.grandFinal.loser)) {
    return data.grandFinal.loser;
  }
  return null;
}

/**
 * Generate a groups + playoff bracket. Two-phase format:
 *   1. Group stage — players are snake-seeded into `groupCount`
 *      groups, each runs round-robin internally. Match ids
 *      `gp_{groupName}_{round}_{idx}`.
 *   2. Playoff — single-elim seeded with the top-`advanceFromGroup`
 *      finishers from each group, in standard cross-group order:
 *      seed 1 of group A vs seed 2 of group B, etc. Match ids
 *      `wb_*` from the single-elim convention. Seats are TBD until
 *      `propagateResults` populates them once every group-stage
 *      match has a winner.
 *
 * Defaults: 2 groups, top 2 advance — produces 4-player single-elim
 * playoff with two semifinals + one final.
 */
export function generateGroupsPlayoff(
  players: Player[],
  opts?: { groupCount?: number; advanceFromGroup?: number },
): BracketData {
  const n = players.length;
  if (n < 2) {
    throw new Error('At least 2 players are required to generate a bracket');
  }

  const groupCount = opts?.groupCount ?? 2;
  const advanceFromGroup = opts?.advanceFromGroup ?? 2;
  if (groupCount < 1) {
    throw new Error('groupCount must be at least 1');
  }
  if (advanceFromGroup < 1) {
    throw new Error('advanceFromGroup must be at least 1');
  }
  // Each group needs at least `advanceFromGroup` players (otherwise we
  // can't fill the playoff seats). Clamp the group count so each group
  // has enough players.
  const maxGroups = Math.max(1, Math.floor(n / advanceFromGroup));
  const effectiveGroups = Math.min(groupCount, maxGroups);

  const groupBuckets = snakeSeedGroups(players, effectiveGroups);
  const groups: GroupStage[] = groupBuckets.map((groupPlayers, i) => {
    const name = String.fromCharCode('A'.charCodeAt(0) + i);
    return {
      name,
      players: groupPlayers,
      rounds: buildGroupRoundRobin(name, groupPlayers),
    };
  });

  // Playoff size = effectiveGroups * advanceFromGroup, padded to next
  // power of two with byes if needed.
  const advancers = effectiveGroups * advanceFromGroup;
  const playoffSize = Math.max(2, Math.pow(2, Math.ceil(Math.log2(advancers))));
  const playoffRounds = Math.ceil(Math.log2(playoffSize));

  // R1 of the playoff: TBD-seat skeleton. `propagateResults` fills the
  // seats once every group-stage match has a winner.
  const playoffR1: Match[] = [];
  for (let i = 0; i < playoffSize / 2; i++) {
    playoffR1.push({
      id: `wb_1_${i}`,
      round: 1,
      matchIndex: i,
      player1: makeTbd(),
      player2: makeTbd(),
      winner: null,
      loser: null,
    });
  }

  const winnersBracket: Match[][] = [playoffR1];
  for (let r = 2; r <= playoffRounds; r++) {
    const round: Match[] = [];
    const prev = winnersBracket[r - 2];
    for (let i = 0; i < prev.length / 2; i++) {
      round.push({
        id: `wb_${r}_${i}`,
        round: r,
        matchIndex: i,
        player1: makeTbd(),
        player2: makeTbd(),
        winner: null,
        loser: null,
        feeder1: prev[i * 2].id,
        feeder2: prev[i * 2 + 1].id,
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
    format: 'groups_playoff',
    players: players.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      number: p.number,
    })),
    bracketSize: playoffSize,
    wbRounds: playoffRounds,
    winnersBracket,
    losersBracket: [],
    grandFinal,
    superFinal,
    groups,
    advanceFromGroup,
    champion: null,
    status: 'active',
  };

  // If a 1-group + 1-advance walkover happens (n=1 rejected above, but
  // tiny edge cases) finalize defensively.
  finalizeGroupsPlayoff(data);
  return data;
}

/** True iff every match in every group has a winner. */
function groupStageComplete(data: BracketData): boolean {
  for (const group of data.groups ?? []) {
    for (const round of group.rounds) {
      for (const m of round) {
        if (!m.winner) return false;
      }
    }
  }
  return true;
}

/**
 * Standard cross-group playoff seeding.
 *
 * For 2 groups (the default), produces R1 pairings
 *   `1A vs 2B, 1B vs 2A, 2A' vs 1B', …` — i.e. each top seed plays a
 *   bottom seed of the OTHER group, alternating which group's top
 *   seed is in slot 0. Top seeds therefore can't meet until R2+.
 *
 * For K > 2 groups, falls back to a best-effort interleave that
 *   spreads top seeds across the bracket. Not the textbook
 *   round-robin draw — TODO: implement standard K-group cross-bracket
 *   seeding (e.g. for 4 groups × top 2, group winners should face
 *   runners-up of other groups, not other group winners).
 *
 * Pads with byes when the playoff size is larger than the actual
 * advancer count (non-power-of-2 advancer counts).
 */
function seedPlayoffSlots(data: BracketData, advanceFromGroup: number): (string | 'bye')[] {
  const groups = data.groups ?? [];
  const slots: (string | 'bye')[] = [];

  if (groups.length === 2) {
    // 2-group cross-bracket. Walk i from 0 to advanceFromGroup/2 and
    // emit two cross-pairs at each step (top-i of A vs bottom-partner
    // of B; mirror for B vs A). For odd advanceFromGroup, the middle
    // index pairs the groups' midfielders against each other.
    const [a, b] = groups.map((g) => getGroupStandings(data, g.name));
    for (let i = 0; i < advanceFromGroup; i++) {
      const partnerIdx = advanceFromGroup - 1 - i;
      if (i < partnerIdx) {
        slots.push(a[i]?.playerId ?? 'bye');
        slots.push(b[partnerIdx]?.playerId ?? 'bye');
        slots.push(b[i]?.playerId ?? 'bye');
        slots.push(a[partnerIdx]?.playerId ?? 'bye');
      } else if (i === partnerIdx) {
        slots.push(a[i]?.playerId ?? 'bye');
        slots.push(b[i]?.playerId ?? 'bye');
      }
      // i > partnerIdx — already emitted in an earlier iteration
    }
  } else {
    // K-group fallback (best-effort).
    for (let pos = 0; pos < advanceFromGroup; pos++) {
      const groupOrder = pos % 2 === 0 ? groups : groups.slice().reverse();
      for (const group of groupOrder) {
        const standings = getGroupStandings(data, group.name);
        const row = standings[pos];
        slots.push(row?.playerId ?? 'bye');
      }
    }
  }

  // Pad to playoff size with byes.
  while (slots.length < data.bracketSize) slots.push('bye');
  return slots;
}

/**
 * Run after the group stage completes — fill the playoff R1 seats and
 * auto-resolve any bye matches. Subsequent rounds populate via the
 * standard single-elim propagation below.
 */
function seedPlayoffR1(data: BracketData): void {
  // Detect already-seeded — once R1 has any non-TBD seats, we've already
  // done the work and propagation should not re-seed.
  const r1 = data.winnersBracket[0];
  if (!r1 || r1.length === 0) return;
  if (r1.some((m) => !isTbd(m.player1.id) || !isTbd(m.player2.id))) return;

  const advanceFromGroup = inferAdvanceFromGroup(data);
  const slots = seedPlayoffSlots(data, advanceFromGroup);

  r1.forEach((match, i) => {
    const a = slots[i * 2];
    const b = slots[i * 2 + 1];
    match.player1 = a === 'bye' ? makeBye() : getPlayerObj(data, a);
    match.player2 = b === 'bye' ? makeBye() : getPlayerObj(data, b);

    if (isBye(match.player1.id) && isReal(match.player2.id)) {
      match.winner = match.player2.id;
      match.loser = 'bye';
    } else if (isBye(match.player2.id) && isReal(match.player1.id)) {
      match.winner = match.player1.id;
      match.loser = 'bye';
    } else if (isBye(match.player1.id) && isBye(match.player2.id)) {
      match.winner = 'bye';
      match.loser = 'bye';
    }
  });
}

/**
 * Read the `advanceFromGroup` count off the bracket. Persisted by
 * `generateGroupsPlayoff` so non-power-of-2 advancer counts work
 * correctly (the playoff is padded with byes; inferring as
 * `bracketSize / groupCount` would over-count).
 *
 * Falls back to `bracketSize / groupCount` for legacy brackets that
 * predate the persisted field — pre-existing brackets don't exist
 * yet in production but the fallback keeps the type-loose readers
 * happy.
 */
function inferAdvanceFromGroup(data: BracketData): number {
  if (data.advanceFromGroup !== undefined) return data.advanceFromGroup;
  const groups = data.groups ?? [];
  if (groups.length === 0) return 1;
  return Math.max(1, Math.floor(data.bracketSize / groups.length));
}

/**
 * Propagation for `groups_playoff`:
 *   - Group stage incomplete → no-op (waiting for more results).
 *   - Group stage just completed → seed playoff R1.
 *   - Playoff R1 already seeded → standard single-elim propagation
 *     (seat winners into next round, auto-resolve byes).
 *   - Playoff complete → champion + status: 'completed'.
 */
function finalizeGroupsPlayoff(data: BracketData): void {
  if (data.format !== 'groups_playoff') return;

  if (!groupStageComplete(data)) return;

  // Seed R1 if we haven't yet.
  seedPlayoffR1(data);

  // Single-elim propagation for the playoff side. Same logic as
  // `generateSingleElimination`'s propagation branch.
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

  // Crown champion if the playoff final has a real winner.
  const lastRound = data.winnersBracket[data.winnersBracket.length - 1];
  const final = lastRound?.[0];
  if (final?.winner && !isBye(final.winner)) {
    data.champion = final.winner;
    data.status = 'completed';
  }
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

  // Groups + playoff: handle group-stage finalize → playoff seeding,
  // then single-elim propagation through the playoff side.
  if (data.format === 'groups_playoff') {
    finalizeGroupsPlayoff(data);
    return;
  }

  // Armfight: a single match decides everything. No bracket propagation.
  if (data.format === 'armfight') {
    finalizeArmfight(data);
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

  // Refuse to reset auto-resolved bye matches. They were never "played"
  // — the bye slot makes the result deterministic — and clearing the
  // winner leaves the match in `{real, bye, winner: null}` which
  // `canRecordResult` then rejects (BYE-in-slot guard), giving the
  // operator no way to un-stick the bracket short of regeneration.
  if (match.player1.id === 'bye' || match.player2.id === 'bye') return data;

  const oldWinner = match.winner;
  const oldLoser = match.loser;

  // Clear the match itself
  match.winner = null;
  match.loser = null;
  match.enteredBy = null;
  match.enteredAt = null;
  match.correctedBy = null;
  match.correctedAt = null;
  // Reset drops the sport-specific result too so the next recordResult
  // starts clean. (`selectWinner` only overwrites `result` when the caller
  // explicitly passes one, so without this the stale payload would linger
  // after a reset → record-again cycle.)
  match.result = null;

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

  // Groups + playoff:
  //   - If a group-stage match is reset, every playoff seat depended
  //     on the standings going into it. Wipe playoff to TBD skeletons.
  //   - If a playoff match is reset, do the standard single-elim
  //     downstream cascade.
  if (data.format === 'groups_playoff') {
    if (data.champion === oldWinner) {
      data.champion = null;
      data.status = 'active';
    }

    const isGroupStageMatch = matchId.startsWith('gp_');
    if (isGroupStageMatch) {
      // Wipe the entire playoff back to TBD skeletons. Once the
      // group-stage match is re-recorded, finalize will reseed.
      for (const round of data.winnersBracket) {
        for (const slot of round) {
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
    } else {
      // Playoff match — standard single-elim downstream cascade.
      _clearDownstream(data, oldWinner, oldLoser);
    }

    finalizeGroupsPlayoff(data);
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
      (m as Match).result = null;
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
  /**
   * Optional sport-specific result detail. Opaque to the engine — stored
   * verbatim on the match and echoed back via `findMatch`. Pass `null` to
   * explicitly clear a previously-recorded payload (e.g. on correction
   * where the new result has none). If omitted, an existing payload is
   * preserved — so a plain winner correction doesn't silently wipe the
   * armwrestling victoryType / fouls / etc. recorded earlier.
   */
  result?: Record<string, unknown> | null,
): BracketData {
  const match = findMatch(data, matchId);
  if (!match) return data;

  // Defensive guard: refuse to overwrite an auto-resolved bye match.
  // `canRecordResult` already rejects these at the API boundary, but
  // a misbehaving caller (or a UI that surfaces every match without
  // gating) could reach here directly and corrupt the standings —
  // e.g. setting a real player as winner of a bye-walkover would
  // double-credit the win in `getRoundRobinStandings`.
  if (match.winner === 'bye' || match.loser === 'bye') return data;

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

  if (result !== undefined) {
    match.result = result;
  }

  propagateResults(data);
  return data;
}
