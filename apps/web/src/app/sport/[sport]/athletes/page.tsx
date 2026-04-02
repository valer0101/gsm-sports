import type { PaginatedResponse, Athlete } from '@/types/api';
import { AthletesPageClient } from '@/app/athletes/_AthletesPageClient';

async function fetchInitial(sport: string): Promise<PaginatedResponse<Athlete> | undefined> {
  try {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/athletes?limit=20&sport=${sport}`, { next: { revalidate: 60 } });
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export default async function SportAthletesPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const initialData = await fetchInitial(sport);
  return <AthletesPageClient initialData={initialData} sport={sport} />;
}
