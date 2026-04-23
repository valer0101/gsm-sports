import { notFound } from 'next/navigation';
import type { Tournament } from '@/types/api';
import { BroadcastOverlay } from './BroadcastOverlay';

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
 * OBS browser-source overlay for ONE table.
 *
 * Opened in OBS Studio as a browser source (typically 1920x1080). Shows
 * the current match with big player names + photos, designed to sit on
 * top of a video feed. Query params:
 *
 *   ?bg=transparent (default, for chroma-free overlay on a video capture)
 *   ?bg=dark         (opaque dark background, standalone preview)
 *
 * No auth — same public model as the arena display (#19). Wire shape is
 * `GET /tournaments/:slug` + `GET /tournaments/:id/schedule` + `GET
 * /tournaments/:id/tables` + `GET /brackets/tournament/:id` to resolve
 * matchId → player names.
 */
export default async function BroadcastOverlayPage({
  params,
}: {
  params: Promise<{ slug: string; tableId: string }>;
}) {
  const { slug, tableId } = await params;
  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  return <BroadcastOverlay tournament={tournament} tableId={tableId} />;
}
