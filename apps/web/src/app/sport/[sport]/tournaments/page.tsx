import type { PaginatedResponse, Tournament } from '@/types/api';
import { TournamentsPageClient } from '@/app/tournaments/_TournamentsPageClient';

async function fetchInitial(sport: string): Promise<PaginatedResponse<Tournament> | undefined> {
  try {
    const apiUrl =
      process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/tournaments?limit=100&sport=${sport}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export default async function SportTournamentsPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  const initialData = await fetchInitial(sport);
  return <TournamentsPageClient initialData={initialData} sport={sport} />;
}
