import type { PaginatedResponse, RankingEntry } from '@/types/api';
import { RankingsPageClient } from '@/app/rankings/_RankingsPageClient';

async function fetchInitial(sport: string): Promise<PaginatedResponse<RankingEntry> | undefined> {
  try {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/rankings/world?limit=50&sport=${sport}`, { next: { revalidate: 60 } });
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export default async function SportRankingsPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const initialData = await fetchInitial(sport);
  return <RankingsPageClient initialData={initialData} sport={sport} />;
}
