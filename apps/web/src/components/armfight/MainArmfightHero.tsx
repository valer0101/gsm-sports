import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { Tournament } from '@/types/api';
import { Countdown } from './Countdown';

function weightTitle(t: Tournament): string | null {
  const v = t.sportConfig?.weightTitle;
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/** Pure presentational hero. Returns null when there is nothing to promote
 *  (no event, or the event is terminal — finished/cancelled). */
export function MainArmfightHero({ tournament }: { tournament: Tournament | null }) {
  const tr = useTranslations('armfight');
  if (!tournament) return null;
  if (tournament.status === 'completed' || tournament.status === 'cancelled') return null;

  const badge = weightTitle(tournament);

  return (
    <section
      className="relative overflow-hidden"
      style={{
        background:
          'radial-gradient(120% 90% at 50% 30%, rgba(200,16,46,0.18), transparent 60%), linear-gradient(180deg, rgba(15,15,26,0.55), rgba(15,15,26,0.97)), linear-gradient(135deg,#241018,#15152a 55%,#0F0F1A)',
      }}
    >
      {tournament.posterUrl && (
        <Image
          src={tournament.posterUrl}
          alt={tournament.name}
          fill
          priority
          className="object-cover -z-10 opacity-60"
        />
      )}
      <div className="max-w-5xl mx-auto px-4 py-20 sm:py-28 flex flex-col items-center text-center">
        {badge && (
          <span
            data-testid="af-badge"
            className="text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full mb-4"
            style={{ background: 'var(--color-accent)', color: '#0F0F1A' }}
          >
            {badge}
          </span>
        )}
        <h2 className="text-4xl sm:text-5xl font-black text-white leading-none">
          {tournament.name}
        </h2>
        {tournament.city && (
          <p
            data-testid="af-city"
            className="mt-3 text-sm"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {tournament.city} · {tr('starts_in')}
          </p>
        )}
        <div className="mt-6">
          <Countdown targetIso={tournament.startDate} />
        </div>
        <div className="mt-7 flex flex-wrap gap-3 justify-center">
          <Link
            href={`/tournaments/${tournament.slug}`}
            className="px-6 py-3 rounded-md text-sm font-black uppercase tracking-wide text-white"
            style={{ background: 'var(--color-primary)' }}
          >
            {tr('cta_bracket')}
          </Link>
          <Link
            href={`/tournaments/${tournament.slug}`}
            className="px-6 py-3 rounded-md text-sm font-black uppercase tracking-wide border border-white/40 text-white"
          >
            {tr('cta_details')}
          </Link>
        </div>
      </div>
    </section>
  );
}
