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
  status: 'draft' | 'upcoming' | 'active' | 'completed' | 'cancelled';
  isFeatured: boolean;
  isLive: boolean;
  posterUrl: string | null;
  streamUrl: string | null;
  sport: Sport | null;
  weightCategories: WeightCategory[];
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
