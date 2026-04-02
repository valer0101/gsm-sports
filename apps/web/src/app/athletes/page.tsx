import type { PaginatedResponse, Athlete } from '@/types/api';
import { AthletesPageClient } from './_AthletesPageClient';

async function fetchInitialAthletes(): Promise<PaginatedResponse<Athlete> | undefined> {
  try {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/athletes?limit=20`, { next: { revalidate: 60 } });
    if (!res.ok) return undefined;
    return res.json();
  } catch {
    return undefined;
  }
}

export default async function AthletesPage() {
  const initialData = await fetchInitialAthletes();
  return <AthletesPageClient initialData={initialData} />;
}
