import type { PaginatedResponse, Tournament } from '@/types/api';
import { TournamentsPageClient } from './_TournamentsPageClient';

async function fetchInitialTournaments(): Promise<PaginatedResponse<Tournament> | undefined> {
  try {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/tournaments?limit=12`, { next: { revalidate: 60 } });
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export default async function TournamentsPage() {
  const initialData = await fetchInitialTournaments();
  return <TournamentsPageClient initialData={initialData} />;
}
