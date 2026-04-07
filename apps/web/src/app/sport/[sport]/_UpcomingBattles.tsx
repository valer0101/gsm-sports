import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { fetchUpcomingTournaments } from '@/lib/api-server';
import type { Tournament } from '@/types/api';

const UPCOMING_STATUSES = new Set([
  'draft',
  'upcoming',
  'registration_open',
  'registration_closed',
  'bracket_ready',
]);

interface SectionProps {
  title: string;
  accentColor: string;
  badge?: string;
  tournaments: Tournament[];
  sportSlug: string;
}

function Section({ title, accentColor, badge, tournaments }: SectionProps) {
  if (tournaments.length === 0) return null;
  return (
    <div className="mb-14">
      <div className="flex items-center gap-3 mb-6">
        <span className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        <h2 className="text-2xl font-black uppercase tracking-wide text-white">{title}</h2>
        {badge && (
          <span
            className="text-xs font-bold px-2 py-0.5 rounded-full animate-pulse"
            style={{ backgroundColor: accentColor + '30', color: accentColor }}
          >
            {badge}
          </span>
        )}
        <span
          className="ml-2 text-sm font-medium px-2 py-0.5 rounded-full"
          style={{ backgroundColor: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)' }}
        >
          {tournaments.length}
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {tournaments.map((tournament) => (
          <TournamentCard key={tournament.id} tournament={tournament} />
        ))}
      </div>
    </div>
  );
}

export async function UpcomingBattles({ sportSlug }: { sportSlug: string }) {
  const allTournaments = await fetchUpcomingTournaments(sportSlug);
  const t = await getTranslations('tournaments');
  const tNav = await getTranslations('nav');

  const active = allTournaments.filter((item) => item.status === 'active');
  const upcoming = allTournaments.filter((item) => UPCOMING_STATUSES.has(item.status));
  const completed = allTournaments.filter((item) => item.status === 'completed');

  if (allTournaments.length === 0) return null;

  return (
    <section className="px-4 py-14">
      <div className="max-w-6xl mx-auto">
        {/* Section header with link to all */}
        <div className="flex items-center justify-between mb-10">
          <h2 className="text-3xl font-black uppercase tracking-wide text-white">{t('title')}</h2>
          <Link
            href={`/sport/${sportSlug}/tournaments`}
            className="text-sm font-semibold uppercase tracking-wide flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-primary)' }}
          >
            {tNav('tournaments')} →
          </Link>
        </div>

        {/* Ακτив — идёт прямо сейчас */}
        <Section
          title={t('active')}
          accentColor="#ef4444"
          badge="LIVE"
          tournaments={active}
          sportSlug={sportSlug}
        />

        {/* Αռαджиκα — предстоящие */}
        <Section
          title={t('upcoming')}
          accentColor="var(--color-primary)"
          tournaments={upcoming}
          sportSlug={sportSlug}
        />

        {/* Αβαρτβαδ — завершённые */}
        <Section
          title={t('completed')}
          accentColor="#6b7280"
          tournaments={completed}
          sportSlug={sportSlug}
        />
      </div>
    </section>
  );
}
