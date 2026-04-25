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
   * propagation in `propagateResults`: single-elim ends at the WB final
   * and never plays the grand final / super final.
   */
  format?: 'single_elim' | 'double_elim';
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
