import { notFound } from 'next/navigation';
import type { Tournament } from '@/types/api';
import { ArenaDisplay } from './ArenaDisplay';

async function getTournament(slug: string): Promise<Tournament | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/tournaments/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Venue projector / arena display. Public, read-only, auto-refreshing —
 * designed to be opened in a browser and thrown on the big screen.
 *
 * Deliberately NOT routed under `/operator` or `/admin` because spectators
 * and streaming crews need to reach it without a login.
 */
export default async function ArenaPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  return <ArenaDisplay tournament={tournament} />;
}
