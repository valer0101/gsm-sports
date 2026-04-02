import type { PaginatedResponse, RankingEntry } from '@/types/api';
import { RankingsPageClient } from './_RankingsPageClient';

async function fetchInitialRankings(): Promise<PaginatedResponse<RankingEntry> | undefined> {
  try {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/rankings/world?limit=50`, { next: { revalidate: 60 } });
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export default async function RankingsPage() {
  const initialData = await fetchInitialRankings();
  return <RankingsPageClient initialData={initialData} />;
}
