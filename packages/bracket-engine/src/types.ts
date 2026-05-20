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
  result?: Record<string, unknown> | ArmfightBoutResult | null;
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
   *   - `groups_playoff` runs round-robin inside each group (in `groups`)
   *     then a single-elim playoff (in `winnersBracket`) seeded with the
   *     top-N from each group. Champion = playoff winner.
   */
  format?:
    | 'single_elim'
    | 'double_elim'
    | 'round_robin'
    | 'swiss'
    | 'groups_playoff'
    | 'armfight';

  /**
   * Group stage for `groups_playoff` (Phase 3.3d). One entry per group;
   * each is a self-contained mini-round-robin. Match ids are
   * `gp_{groupName}_{round}_{idx}` so they don't collide with playoff
   * `wb_*`. Undefined for every other format.
   */
  groups?: GroupStage[];
  /**
   * How many top finishers per group advance to the playoff. Only set
   * for `groups_playoff` — read at finalization time to seed the playoff
   * bracket. Stored explicitly rather than inferred from `bracketSize /
   * groups.length` because that inference is wrong when advancers ×
   * groupCount isn't a power of two (the playoff is padded with byes).
   */
  advanceFromGroup?: number;
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

/**
 * One row of a tournament-wide final-placement table (Phase 3.4 —
 * team standings). Computed by `getFinalPlacements` from a single
 * `BracketData`; the caller aggregates across all brackets of a
 * tournament when scoring teams. `position` is 1-based competition
 * ranking (ties share a position). Only real players are included —
 * `bye` / `tbd` seats are filtered out.
 */
export interface FinalPlacement {
  playerId: string;
  position: number;
}

/**
 * One group in the `groups_playoff` format (Phase 3.3d). Self-
 * contained mini-round-robin — `rounds` matches the
 * `winnersBracket: Match[][]` shape used elsewhere, with match ids
 * `gp_{name}_{round}_{idx}` to avoid collision with the playoff
 * `wb_*` ids that share the same `BracketData.winnersBracket` array.
 */
export interface GroupStage {
  name: string;
  players: Player[];
  rounds: Match[][];
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

// ─── Armfight fight-card (sub-project B) ────────────────────

export type ArmfightHand = 'left' | 'right';
export type LegWinType = 'pin' | 'foul' | 'dq';
export type ArmfightBoutStatus = 'pending' | 'in_progress' | 'completed' | 'walkover';

export interface ArmfightLeg {
  /** 1..5, strictly monotonic. */
  index: number;
  /** Must equal Match.player1.id or Match.player2.id. Never 'bye'/'tbd'. */
  winnerId: string;
  winType: LegWinType;
  enteredBy?: string | null;
  enteredAt?: string | null;
}

export interface ArmfightBoutResult {
  hand: ArmfightHand;
  /** 0..5, append-only until the bout closes. */
  legs: ArmfightLeg[];
  /** Cached count of legs won by Match.player1. Always === legs.filter(l => l.winnerId === player1.id).length. */
  scoreA: number;
  /** Cached count of legs won by Match.player2. */
  scoreB: number;
  status: ArmfightBoutStatus;
  /** Only set when status === 'walkover'. */
  walkoverReason?: string | null;
}

export interface ArmfightPairSpec {
  playerA: Player;
  playerB: Player;
  hand: ArmfightHand;
  /** Optional display order; defaults to array index + 1 during generation. */
  order?: number;
}

export interface RecordLegOptions {
  enteredBy?: string | null;
  enteredAt?: string | null;
}
