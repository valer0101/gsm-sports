import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import type { PaginatedResponse, Tournament } from '@/types/api';

async function fetchUpcoming(sport: string): Promise<Tournament[]> {
  try {
    const apiUrl = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(
      `${apiUrl}/tournaments?limit=3&sport=${sport}&status=upcoming`,
      { next: { revalidate: 60 } },
    );
    if (!res.ok) return [];
    const json: PaginatedResponse<Tournament> = await res.json();
    return json.data ?? [];
  } catch {
    return [];
  }
}

export async function UpcomingBattles({ sportSlug }: { sportSlug: string }) {
  const tournaments = await fetchUpcoming(sportSlug);
  const t = await getTranslations('tournaments');
  const tNav = await getTranslations('nav');

  if (tournaments.length === 0) return null;

  return (
    <section className="px-4 py-14">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <span
              className="w-4 h-4 rounded-sm shrink-0"
              style={{ backgroundColor: 'var(--color-primary)' }}
            />
            <h2 className="text-2xl font-black uppercase tracking-wide text-white">
              {t('upcoming')}
            </h2>
          </div>
          <Link
            href={`/sport/${sportSlug}/tournaments`}
            className="text-sm font-semibold uppercase tracking-wide flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            {tNav('tournaments')} →
          </Link>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {tournaments.map((tournament) => (
            <TournamentCard key={tournament.id} tournament={tournament} />
          ))}
        </div>
      </div>
    </section>
  );
}
