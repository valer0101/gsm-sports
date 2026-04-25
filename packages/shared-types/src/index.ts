// ─── User roles ─────────────────────────────────────────────
export type UserRole = 'user' | 'athlete' | 'organizer' | 'admin' | 'super_admin';

// ─── Sports ─────────────────────────────────────────────────
export type SportSlug = 'armwrestling' | 'boxing' | 'mma' | string;

/** Defines how participants are grouped for a sport. */
export type CategoriesType = 'weight' | 'age' | 'skill' | 'none';

/** Supported bracket formats — what `bracket-engine` can generate. */
export type BracketFormat =
  | 'single_elim'
  | 'double_elim'
  | 'round_robin'
  | 'swiss'
  | 'groups_playoff';

/**
 * What data is recorded for a completed match. Determines which UI fields the
 * operator sees when entering a result, and which fields the public bracket
 * surfaces. Start simple and grow as sports are added.
 */
export type MatchResultSchema =
  | 'simple_winner' // just winnerId (default fallback)
  | 'armwrestling' // winnerId + victoryType + fouls + round durations
  | 'score' // winnerId + team scores per period (football, basketball…)
  | 'time' // no winner per match — ranked by fastest time (swimming, running)
  | 'points'; // winnerId + judge point totals (boxing, MMA by decision)

/** A label localised to all supported UI locales. */
export interface LocalizedTerm {
  ru: string;
  en: string;
  hy: string;
}

/**
 * Sport-level configuration.
 *
 * Stored in `sports.config` (JSONB). This is the SHAPE of what's there — the
 * DB doesn't enforce it; writes are validated by `SportConfigDto` (apps/api)
 * and reads go through `resolveSportConfig(slug, raw)` which fills defaults.
 *
 * Runtime presets + resolver live in `apps/api/src/sports/sport-config.ts`;
 * this package is types-only per the @gsm/shared-types contract.
 *
 * Keep this deliberately narrow — platform-wide behavior for a sport. Anything
 * that varies between tournaments of the same sport (prizes, entry fees,
 * which weight categories are used *for this event*) lives on
 * Tournament.sportConfig instead.
 */
export interface SportConfig {
  /** How participants are split into divisions. */
  categoriesType: CategoriesType;
  /** True iff the sport has a left/right hand distinction (armwrestling). */
  hasHands: boolean;
  /** Bracket formats the organizer can choose from for this sport. */
  bracketFormats: BracketFormat[];
  /** Format used when the organizer doesn't pick one explicitly. */
  defaultBracketFormat: BracketFormat;
  /** Shape of a recorded match result. */
  matchResultSchema: MatchResultSchema;
  /** True iff participants must be officially weighed-in before the bracket is generated. */
  weighInRequired: boolean;
  /**
   * Label for the "playing surface": table for armwrestling, ring for boxing,
   * cage for MMA, court for tennis, field for football. Localised per UI
   * locale so the frontend can pick the right word.
   */
  surfaceTerm?: { singular: LocalizedTerm; plural: LocalizedTerm };
  /** Label for participants — athletes vs teams. Localised. */
  participantTerm?: { singular: LocalizedTerm; plural: LocalizedTerm };
  /**
   * Typical duration of a single match in seconds — the scheduler's `avg`
   * input. Per-sport platform default; `Tournament.sportConfig` may override
   * per event.
   */
  avgMatchDurationSec: number;
  /**
   * Minimum rest between an athlete's own matches in seconds. Fatigue +
   * rule-of-thumb, overridable per tournament.
   */
  minRestBetweenMatchesSec: number;
  /**
   * If true, the organizer is expected to check athletes in on site before
   * their category starts. The "start category" action auto-forfeits any
   * entry that isn't `checked_in` at that moment. Combat sports default to
   * true (medical / no-show handling), chess-type sports default to false.
   */
  requireCheckIn: boolean;
}

// ─── Match result detail (Phase 3.2) ────────────────────────
/**
 * Sport-specific details recorded alongside the winnerId on a completed
 * match. The `schema` discriminator matches `SportConfig.matchResultSchema`
 * so the operator UI can pick the right form and the public bracket the
 * right display, from a single codepath.
 *
 * `winnerId` always lives on the enclosing `Match` (the bracket engine
 * needs it to propagate); these payloads are structured *detail* — pin
 * vs points vs DQ for armwrestling, per-period scores, judge cards, etc.
 *
 * The `simple_winner` variant is a no-op shape so the field can be
 * present uniformly — useful for `notes` without committing to a sport.
 */
export interface ArmwrestlingMatchResult {
  schema: 'armwrestling';
  /** How the win was decided. `pin` = shoulder to pad; `dq` = disqualification. */
  victoryType: 'pin' | 'points' | 'fouls' | 'dq';
  /** One entry per played round. Missing = best-of-one. */
  rounds?: Array<{ winnerId: string; durationMs?: number }>;
  /** Fouls accrued per player id. Missing key = 0 fouls. */
  fouls?: Record<string, number>;
  notes?: string;
}

export interface ScoreMatchResult {
  schema: 'score';
  /** Per-period scoreline, >=1 entry. `player1`/`player2` mirror `Match.player1/player2`. */
  periods: Array<{ player1: number; player2: number }>;
  /** Final totals. Redundant with periods but kept for display. */
  finalPlayer1: number;
  finalPlayer2: number;
  notes?: string;
}

export interface PointsMatchResult {
  schema: 'points';
  /** One entry per judge, >=1 entry. */
  cards: Array<{ judge?: string; player1: number; player2: number }>;
  notes?: string;
}

export interface TimeMatchResult {
  schema: 'time';
  /** Finish time per athlete, in milliseconds. */
  player1Ms: number;
  player2Ms: number;
  notes?: string;
}

/** Fallback shape — holds free-form notes when the sport uses `simple_winner`. */
export interface SimpleMatchResult {
  schema: 'simple_winner';
  notes?: string;
}

/** Discriminated union; pick by the `schema` field. */
export type MatchResult =
  | ArmwrestlingMatchResult
  | ScoreMatchResult
  | PointsMatchResult
  | TimeMatchResult
  | SimpleMatchResult;

// ─── Tournaments ────────────────────────────────────────────
export type TournamentStatus =
  | 'draft'
  | 'upcoming'
  | 'registration'
  | 'active'
  | 'completed'
  | 'cancelled';

export type TournamentFormat = 'single_elimination' | 'double_elimination' | 'round_robin';

export type Hand = 'left' | 'right' | 'both';

export type Gender = 'male' | 'female';

export type ExperienceLevel = 'beginner' | 'amateur' | 'semi_pro' | 'pro';

// ─── Tournament entry ───────────────────────────────────────
export type EntryStatus = 'pending' | 'confirmed' | 'checked_in' | 'withdrawn' | 'disqualified';

// ─── Tables / rings / courts ────────────────────────────────
/**
 * Status of a playing surface (table / ring / court / cage …) within a tournament.
 * - `idle`: free, eligible to receive the next pending match.
 * - `busy`: a match is currently in progress.
 * - `offline`: temporarily taken out of rotation (equipment failure, break, etc).
 */
export type TableStatus = 'idle' | 'busy' | 'offline';

/**
 * A physical playing surface inside a tournament venue. Called "table" in code
 * regardless of sport — the user-facing label comes from the sport's
 * `surfaceTerm` ("table" / "ring" / "court" / "cage").
 */
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

/**
 * One match-to-table assignment. Active while `finishedAt` is null — at most
 * one active assignment per match is enforced at the service layer.
 */
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

/**
 * Shape returned by `GET /v1/tournaments/:id/schedule`. Extends the pure
 * scheduler output (`scheduled` + `unscheduled`) with `active` — the matches
 * currently in progress. The scheduler itself doesn't know about them
 * (they're excluded from its pending input by design), but consumers like
 * the arena display and operator UI need them to render the current state.
 */
export interface ScheduleActiveMatch {
  tableId: string;
  matchId: string;
  bracketId: string;
  startedAt: string | null;
  /** Epoch ms — projected end (= startedAt + avgMatchDurationSec * 1000). */
  estimatedEndAt: number;
}

/**
 * Wire shape of `GET /v1/tournaments/:id/schedule`.
 *
 * Mirrors `SchedulerOutput` from `@gsm/scheduler` (scheduled + unscheduled)
 * plus an `active` array for matches currently in progress. Declared here
 * rather than in the scheduler package to keep that package pure-algorithm
 * with no knowledge of server-side state like table assignments.
 */
export interface TournamentScheduleResponse {
  scheduled: Array<{
    matchId: string;
    bracketId: string;
    tableId: string;
    estimatedStartAt: number;
    estimatedEndAt: number;
    order: number;
  }>;
  unscheduled: Array<{
    matchId: string;
    bracketId: string;
    athleteIds: [string, string];
  }>;
  active: ScheduleActiveMatch[];
}

// ─── Weigh-ins ──────────────────────────────────────────────
/**
 * Official weigh-in record. One row per `TournamentEntry`. Created by an
 * admin/organizer on event day for sports whose `SportConfig.weighInRequired`
 * is true (armwrestling / boxing / mma / jiu_jitsu by default); bracket
 * generation is blocked until every confirmed entry in the category has one.
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

// ─── News ───────────────────────────────────────────────────
export type NewsStatus = 'draft' | 'published' | 'archived';

// ─── Reviews ────────────────────────────────────────────────
export type ReviewTargetType = 'tournament' | 'athlete' | 'news' | 'video';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';

// ─── Comments ───────────────────────────────────────────────
export type CommentTargetType = 'news' | 'video' | 'tournament' | 'match';

// ─── Rankings ───────────────────────────────────────────────
export type RankingType = 'world' | 'country' | 'weight_class';

// ─── Video ──────────────────────────────────────────────────
export type VideoSource = 'youtube' | 'upload' | 'mux';

// ─── Locales ────────────────────────────────────────────────
export type Locale = 'ru' | 'en' | 'hy';
export const SUPPORTED_LOCALES: Locale[] = ['ru', 'en', 'hy'];
export const DEFAULT_LOCALE: Locale = 'hy';

// ─── API response types ─────────────────────────────────────
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  error: string;
  message: string;
  details?: Array<{ field: string; message: string }>;
}

// ─── Auth ───────────────────────────────────────────────────
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: UserRole[];
  avatarUrl?: string;
}
