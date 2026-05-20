import type { PaginatedResponse, RankingEntry, Tournament } from '@/types/api';
import { isArmfightTournament } from '@/lib/armfight';

const API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

/** Statuses considered "published" for public promo surfaces. Mirrors the
 *  backend allowlist in TournamentsService.findFeaturedArmfight — drafts must
 *  never leak through the upcoming-armfights list either. */
const PUBLISHED_STATUSES: ReadonlySet<Tournament['status']> = new Set([
  'upcoming',
  'registration_open',
  'registration_closed',
  'bracket_ready',
  'active',
]);

export async function fetchUpcomingTournaments(sport: string): Promise<Tournament[]> {
  try {
    const res = await fetch(`${API_URL}/tournaments?limit=50&sport=${sport}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json: PaginatedResponse<Tournament> = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchWorldRankings(
  sport: string,
  hand: 'right' | 'left',
  weightCategory = '115+',
): Promise<PaginatedResponse<RankingEntry> | undefined> {
  try {
    const url = `${API_URL}/rankings/world?sport=${sport}&hand=${hand}&weightCategory=${encodeURIComponent(weightCategory)}&limit=20`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export async function fetchFeaturedArmfight(): Promise<Tournament | null> {
  try {
    const res = await fetch(`${API_URL}/tournaments/featured-armfight`, {
      next: { revalidate: 30 },
    });
    if (res.status === 204 || !res.ok) return null;
    return (await res.json()) as Tournament;
  } catch {
    return null;
  }
}

export async function fetchUpcomingArmfights(): Promise<Tournament[]> {
  try {
    const res = await fetch(`${API_URL}/tournaments?format=armfight&limit=50`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    const json: PaginatedResponse<Tournament> = await res.json();
    return (json.data ?? [])
      .filter(isArmfightTournament)
      .filter((x) => PUBLISHED_STATUSES.has(x.status));
  } catch {
    return [];
  }
}
