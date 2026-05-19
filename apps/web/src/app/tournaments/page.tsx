import type { PaginatedResponse, Tournament } from '@/types/api';
import { fetchFeaturedArmfight } from '@/lib/api-server';
import { MainArmfightMiniCard } from '@/components/armfight/MainArmfightMiniCard';
import { TournamentsPageClient } from './_TournamentsPageClient';

async function fetchInitialTournaments(): Promise<PaginatedResponse<Tournament> | undefined> {
  try {
    const apiUrl =
      process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/tournaments?limit=100`, { next: { revalidate: 60 } });
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export default async function TournamentsPage() {
  const initialData = await fetchInitialTournaments();
  const featured = await fetchFeaturedArmfight();
  return (
    <>
      <div className="max-w-6xl mx-auto px-4 pt-6">
        <MainArmfightMiniCard tournament={featured} />
      </div>
      <TournamentsPageClient initialData={initialData} />
    </>
  );
}
