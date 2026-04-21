export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
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

export type AgeGroup = 'juniors' | 'adults' | 'veterans';

export interface TournamentEntry {
  id: string;
  tournamentId: string;
  userId: string;
  ageGroup: AgeGroup | null;
  hand: 'left' | 'right' | null;
  weightKg: number | null;
  status: 'pending' | 'confirmed' | 'cancelled';
  notes: string | null;
  createdAt: string;
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
}

export interface BracketData {
  players: BracketPlayer[];
  bracketSize: number;
  wbRounds: number;
  winnersBracket: BracketMatch[][];
  losersBracket: BracketMatch[][];
  grandFinal: BracketMatch;
  superFinal: BracketMatch & { needed: boolean };
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

export interface PendingMatch {
  matchId: string;
  player1: BracketPlayer;
  player2: BracketPlayer;
  section: 'winners' | 'losers' | 'grand_final' | 'super_final';
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
