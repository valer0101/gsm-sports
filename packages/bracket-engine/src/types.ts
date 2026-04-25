export interface Player {
  id: string;
  firstName: string;
  lastName: string;
  number: string | number;
  seed?: number;
  photoUrl?: string | null;
}

export interface Match {
  id: string;
  round: number;
  matchIndex: number;
  player1: Player;
  player2: Player;
  winner: string | null;
  loser: string | null;
  feeder1?: string;
  feeder2?: string;
  isLosers?: boolean;
  // Audit fields
  enteredBy?: string | null;
  enteredAt?: string | null;
  correctedBy?: string | null;
  correctedAt?: string | null;
  /**
   * Sport-specific result detail (Phase 3.2). Opaque from the engine's
   * perspective — the API boundary types this as `MatchResult` (from
   * `@gsm/shared-types`) and validates the shape against the tournament's
   * `SportConfig.matchResultSchema`. The engine just carries it alongside
   * `winner` / `loser`. `null` or missing = no detail recorded yet.
   */
  result?: Record<string, unknown> | null;
}

export interface GrandFinalMatch {
  id: string;
  player1: Player;
  player2: Player;
  winner: string | null;
  loser: string | null;
  // Audit fields
  enteredBy?: string | null;
  enteredAt?: string | null;
  correctedBy?: string | null;
  correctedAt?: string | null;
  /** See `Match.result`. */
  result?: Record<string, unknown> | null;
}

export interface SuperFinalMatch extends GrandFinalMatch {
  needed: boolean;
}

export interface BracketData {
  /**
   * Which generator produced this bracket. Optional for backward
   * compatibility with brackets stored before Phase 3.3 — readers should
   * treat `undefined` as `'double_elim'`. Drives format-specific
   * propagation in `propagateResults`:
   *   - `single_elim` ends at the WB final, no LB/GF/SF.
   *   - `round_robin` plays all matches up-front (every player vs every
   *     other), no propagation; champion = unique best W-L record once
   *     every match has a winner.
   *   - `swiss` plays a fixed N rounds; round R+1 is paired by `propagate`
   *     once round R completes, sorted by score and avoiding rematches.
   *     Champion = unique best record after the final round.
   */
  format?: 'single_elim' | 'double_elim' | 'round_robin' | 'swiss';
  players: Player[];
  bracketSize: number;
  wbRounds: number;
  winnersBracket: Match[][];
  /** Empty for `single_elim` — there is no losers' side. */
  losersBracket: Match[][];
  /** Always present for shape stability; never played in single_elim. */
  grandFinal: GrandFinalMatch;
  /** Always present for shape stability; never played in single_elim. */
  superFinal: SuperFinalMatch;
  champion: string | null;
  status: 'active' | 'completed';
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * One row in a round-robin standings table (Phase 3.3b). Computed from
 * `BracketData.winnersBracket` matches by `getRoundRobinStandings` —
 * the engine doesn't cache this; consumers call the helper on read.
 *
 * `position` is "competition ranking" — tied rows share the same
 * position and the next position skips (1, 1, 3, 4). No head-to-head
 * tiebreaker yet; that's a future tightening.
 */
export interface Standing {
  playerId: string;
  /** Display fields lifted from `BracketData.players` for convenience. */
  firstName: string;
  lastName: string;
  played: number;
  wins: number;
  losses: number;
  /** 1-based, ties share the same position. */
  position: number;
}

export const TBD_PLAYER: Player = Object.freeze({
  id: 'tbd',
  firstName: 'TBD',
  lastName: '',
  number: '?',
});

export const BYE_PLAYER: Player = Object.freeze({
  id: 'bye',
  firstName: 'BYE',
  lastName: '',
  number: '-',
});
