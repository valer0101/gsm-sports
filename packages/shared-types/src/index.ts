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
}

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
