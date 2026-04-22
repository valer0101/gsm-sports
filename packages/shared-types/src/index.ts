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

/**
 * Sport-level configuration.
 *
 * Stored in `sports.config` (JSONB). This is the SHAPE of what's there — the
 * DB doesn't enforce it; the app validates writes via SportConfig DTO and
 * reads via {@link resolveSportConfig}, which fills defaults.
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
   * Labels for the "playing surface". A stol (table) for armwrestling, a kort
   * (court) for tennis, a ring for boxing, a pole (field) for football. Used
   * when the UI needs to say e.g. "Match at table 3" vs "Match at ring 3".
   */
  surfaceTerm?: { singular: string; plural: string };
  /**
   * Labels for participants — athletes vs teams. Mostly cosmetic, but
   * affects UI copy and pluralisation.
   */
  participantTerm?: { singular: string; plural: string };
}

/** Safe defaults — used when a sport doesn't have config set yet. */
export const SPORT_CONFIG_DEFAULTS: SportConfig = {
  categoriesType: 'none',
  hasHands: false,
  bracketFormats: ['single_elim', 'double_elim'],
  defaultBracketFormat: 'single_elim',
  matchResultSchema: 'simple_winner',
  weighInRequired: false,
};

/**
 * Per-slug baseline configs used to seed/backfill existing sports. When a new
 * slug ships, add it here so organizers get sensible defaults out of the box.
 */
export const SPORT_CONFIG_PRESETS: Record<string, Partial<SportConfig>> = {
  armwrestling: {
    categoriesType: 'weight',
    hasHands: true,
    bracketFormats: ['double_elim', 'single_elim'],
    defaultBracketFormat: 'double_elim',
    matchResultSchema: 'armwrestling',
    weighInRequired: true,
    surfaceTerm: { singular: 'стол', plural: 'столы' },
  },
  boxing: {
    categoriesType: 'weight',
    bracketFormats: ['single_elim', 'double_elim'],
    defaultBracketFormat: 'single_elim',
    matchResultSchema: 'points',
    weighInRequired: true,
    surfaceTerm: { singular: 'ринг', plural: 'ринги' },
  },
  mma: {
    categoriesType: 'weight',
    bracketFormats: ['single_elim'],
    defaultBracketFormat: 'single_elim',
    matchResultSchema: 'points',
    weighInRequired: true,
    surfaceTerm: { singular: 'клетка', plural: 'клетки' },
  },
  jiu_jitsu: {
    categoriesType: 'weight',
    bracketFormats: ['single_elim', 'double_elim'],
    defaultBracketFormat: 'double_elim',
    matchResultSchema: 'points',
    weighInRequired: true,
  },
  chess: {
    categoriesType: 'skill',
    bracketFormats: ['swiss', 'round_robin', 'single_elim'],
    defaultBracketFormat: 'swiss',
    matchResultSchema: 'simple_winner',
    weighInRequired: false,
  },
};

/**
 * Merge raw stored config with defaults — always returns a fully-populated
 * SportConfig. Used at read time so consumers don't need to null-check.
 */
export function resolveSportConfig(
  slug: string,
  raw: Partial<SportConfig> | null | undefined,
): SportConfig {
  const preset = SPORT_CONFIG_PRESETS[slug] ?? {};
  return { ...SPORT_CONFIG_DEFAULTS, ...preset, ...(raw ?? {}) };
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
