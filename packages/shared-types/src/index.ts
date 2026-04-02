// ─── User roles ─────────────────────────────────────────────
export type UserRole = 'user' | 'athlete' | 'organizer' | 'admin' | 'super_admin';

// ─── Sports ─────────────────────────────────────────────────
export type SportSlug = 'armwrestling' | 'boxing' | 'mma' | string;

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
