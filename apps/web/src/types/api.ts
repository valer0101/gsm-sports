export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export type SportCategoriesType = 'weight' | 'age' | 'skill' | 'none';
export type SportBracketFormat =
  | 'single_elim'
  | 'double_elim'
  | 'round_robin'
  | 'swiss'
  | 'groups_playoff';
export type SportMatchResultSchema =
  | 'simple_winner'
  | 'armwrestling'
  | 'score'
  | 'time'
  | 'points';

export interface LocalizedTerm {
  ru: string;
  en: string;
  hy: string;
}

export interface SportConfig {
  categoriesType: SportCategoriesType;
  hasHands: boolean;
  bracketFormats: SportBracketFormat[];
  defaultBracketFormat: SportBracketFormat;
  matchResultSchema: SportMatchResultSchema;
  weighInRequired: boolean;
  surfaceTerm?: { singular: LocalizedTerm; plural: LocalizedTerm };
  participantTerm?: { singular: LocalizedTerm; plural: LocalizedTerm };
  avgMatchDurationSec: number;
  minRestBetweenMatchesSec: number;
}

export interface Sport {
  id: string;
  slug: string;
  nameRu: string;
  nameEn: string;
  nameHy: string;
  iconUrl: string | null;
  isActive: boolean;
  sortOrder: number;
  /** Always fully populated by the API — defaults applied server-side. */
  config: SportConfig;
}

export interface WeightCategory {
  id: string;
  name: string;
  minWeight: number | null;
  maxWeight: number | null;
  gender: string;
  sortOrder: number;
}

export interface Tournament {
  id: string;
  slug: string;
  name: string;
  nameRu: string | null;
  nameEn: string | null;
  nameHy: string | null;
  descriptionRu: string | null;
  descriptionEn: string | null;
  descriptionHy: string | null;
  startDate: string;
  endDate: string | null;
  location: string | null;
  country: string | null;
  city: string | null;
  format: string;
  maxParticipants: number | null;
  registrationOpen: boolean;
  registrationDeadline: string | null;
  bracketGenerated: boolean;
  status:
    | 'draft'
    | 'upcoming'
    | 'registration_open'
    | 'registration_closed'
    | 'bracket_ready'
    | 'active'
    | 'completed'
    | 'cancelled';
  isFeatured: boolean;
  isLive: boolean;
  posterUrl: string | null;
  streamUrl: string | null;
  sport: Sport | null;
  weightCategories: WeightCategory[];
  sportConfig: Record<string, any> | null;
}

/**
 * Official on-site weigh-in (Phase 3.1). One row per `TournamentEntry`;
 * an upsert overwrites the previous measurement so the UI can assume
 * "one weigh-in per entry at most".
 */
export interface WeighInResponse {
  id: string;
  entryId: string;
  tournamentId: string;
  officialWeightKg: number;
  verifiedBy: string;
  verifiedAt: string;
  createdAt: string;
  updatedAt: string;
}

export type AgeGroup = 'juniors' | 'adults' | 'veterans';

export interface TournamentEntry {
  id: string;
  tournamentId: string;
  userId: string;
  ageGroup: AgeGroup | null;
  hand: 'left' | 'right' | null;
  weightKg: number | null;
  status: 'pending' | 'confirmed' | 'checked_in' | 'rejected' | 'withdrawn';
  notes: string | null;
  createdAt: string;
  checkedInAt?: string | null;
  checkedInBy?: string | null;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    avatarUrl: string | null;
    country: string | null;
  };
}

export interface BracketPlayer {
  id: string;
  firstName: string;
  lastName: string;
  number: string | number;
  seed?: number;
  photoUrl?: string | null;
}

export interface BracketMatch {
  id: string;
  round: number;
  matchIndex: number;
  player1: BracketPlayer;
  player2: BracketPlayer;
  winner: string | null;
  loser: string | null;
  feeder1?: string;
  feeder2?: string;
  isLosers?: boolean;
  // Audit
  enteredBy?: string | null;
  enteredAt?: string | null;
  correctedBy?: string | null;
  correctedAt?: string | null;
  /**
   * Sport-specific result detail (Phase 3.2). Declared as a loose
   * `Record<string, unknown>` here to mirror the engine's opaque carrier;
   * consumers should narrow to `MatchResult` from `@gsm/shared-types` by
   * inspecting `.schema`.
   */
  result?: Record<string, unknown> | null;
}

/**
 * One group in the `groups_playoff` format (Phase 3.3d). Self-contained
 * mini-round-robin schedule. Match ids `gp_{name}_{round}_{idx}`.
 */
export interface BracketGroupStage {
  name: string;
  players: BracketPlayer[];
  rounds: BracketMatch[][];
}

export interface BracketData {
  /**
   * Which generator produced this bracket (Phase 3.3a–d). Optional
   * for backward compatibility — readers should treat `undefined` as
   * `'double_elim'`. Drives top-level layout in `BracketView`:
   * round-robin and swiss render a standings table + round list,
   * groups_playoff renders one standings table per group + a playoff
   * tree, elimination renders the WB/LB tree.
   */
  format?: 'single_elim' | 'double_elim' | 'round_robin' | 'swiss' | 'groups_playoff';
  players: BracketPlayer[];
  bracketSize: number;
  wbRounds: number;
  winnersBracket: BracketMatch[][];
  losersBracket: BracketMatch[][];
  grandFinal: BracketMatch;
  superFinal: BracketMatch & { needed: boolean };
  /** Present iff `format === 'groups_playoff'`. */
  groups?: BracketGroupStage[];
  champion: string | null;
  status: 'active' | 'completed';
}

export interface Bracket {
  id: string;
  tournamentId: string;
  weightCategoryId: string | null;
  bracketData: BracketData | null;
  status: 'pending' | 'active' | 'completed';
  name: string | null;
  isLocked: boolean;
  lastModifiedBy: string | null;
  lastModifiedAt: string | null;
  modificationCount: number;
  completedAt: string | null;
  weightCategory?: WeightCategory;
  /**
   * Nested tournament + sport info used by the result-entry UI to pick the
   * right `MatchResultSchema` form. Optional because not every endpoint
   * that returns a `Bracket` loads these relations; the operator and admin
   * endpoints do.
   */
  tournament?: {
    id: string;
    sport?: { slug: string; config: SportConfig } | null;
    /**
     * Per-tournament override blob — its keys (when present) override the
     * sport-wide `sport.config` per-event. Mirrors the precedence used by
     * the API gate (`assertAllWeighedIn`) and the result-detail validator.
     */
    sportConfig?: Partial<SportConfig> | null;
  };
  createdAt: string;
  updatedAt: string;
}

export interface BracketAuditLog {
  id: string;
  bracketId: string;
  matchId: string | null;
  changedBy: string | null;
  action:
    | 'result_recorded'
    | 'result_corrected'
    | 'match_reset'
    | 'bracket_reset'
    | 'bracket_locked'
    | 'bracket_unlocked';
  oldValue: Record<string, unknown> | null;
  newValue: Record<string, unknown> | null;
  reason: string | null;
  createdAt: string;
}

export type TableStatus = 'idle' | 'busy' | 'offline';

export interface TournamentTable {
  id: string;
  tournamentId: string;
  number: number;
  name: string | null;
  status: TableStatus;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MatchTableAssignment {
  id: string;
  tournamentId: string;
  bracketId: string;
  matchId: string;
  tableId: string;
  claimedBy: string | null;
  assignedAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface OperatorMyTable {
  table: TournamentTable;
  activeAssignment: MatchTableAssignment | null;
}

// Scheduler-shaped types come straight from `@gsm/scheduler`; the wire
// shape of `GET /tournaments/:id/schedule` lives in `@gsm/shared-types`
// (it adds `active` on top of the scheduler's pure output). Both re-
// exported here so page-level consumers import from `@/types/api`.
export type { ScheduledMatch, SchedulerMatch } from '@gsm/scheduler';
export type {
  TournamentScheduleResponse as TournamentSchedule,
  ScheduleActiveMatch,
  MatchResult,
  MatchResultSchema,
  ArmwrestlingMatchResult,
  ScoreMatchResult,
  PointsMatchResult,
  TimeMatchResult,
  SimpleMatchResult,
  TeamStandingsResponse,
  TeamStandingsRow,
  TeamScoringConfig,
} from '@gsm/shared-types';

export interface PendingMatch {
  matchId: string;
  player1: BracketPlayer;
  player2: BracketPlayer;
  section: 'winners' | 'losers' | 'grand_final' | 'super_final';
  /** Active assignment row (null if the match is still unclaimed). */
  assignment?: MatchTableAssignment | null;
  /** True iff the match is claimed to the caller's own table. */
  assignedToMe?: boolean;
  /** True iff the match is claimed to SOME OTHER table (roaming operators only). */
  assignedToOther?: boolean;
}

export interface PendingMatchesByBracket {
  bracketId: string;
  bracketName: string | null;
  isLocked: boolean;
  pendingMatches: PendingMatch[];
}

export interface Athlete {
  id: string;
  slug: string;
  firstName: string;
  lastName: string;
  country: string | null;
  city: string | null;
  gender: 'male' | 'female' | null;
  primaryHand: 'left' | 'right' | 'both' | null;
  weight: number | null;
  height: number | null;
  experienceLevel: string | null;
  photoUrl: string | null;
  worldRank: number | null;
  countryRank: number | null;
  totalPoints: number;
  isVerified: boolean;
  sport: Sport | null;
}

export interface RankingEntry {
  id: string;
  athleteId: string;
  season: number;
  points: number;
  country: string | null;
  hand: string | null;
  gender: string | null;
  weightCategory: string | null;
  worldPosition: number | null;
  countryPosition: number | null;
  athlete: Athlete;
}
