import type { PaginatedResponse, RankingEntry, Tournament } from '@/types/api';

const API_URL =
  process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

export async function fetchUpcomingTournaments(sport: string): Promise<Tournament[]> {
  try {
    const res = await fetch(`${API_URL}/tournaments?limit=3&sport=${sport}&status=upcoming`, {
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
