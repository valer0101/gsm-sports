'use client';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Tournament } from '@/types/api';
import { Countdown } from './Countdown';

/** Compact promo for /tournaments. Upcoming/live: title + countdown.
 *  Finished: stays as a small card with a video/YouTube button (only if a
 *  link is set). Null if there is nothing to show. */
export function MainArmfightMiniCard({ tournament }: { tournament: Tournament | null }) {
  const tr = useTranslations('armfight');
  if (!tournament) return null;

  const finished = tournament.status === 'completed';
  if (finished && !tournament.armfightVideoUrl) return null;
  if (tournament.status === 'cancelled') return null;

  return (
    <div
      data-testid="af-mini"
      className="rounded-xl border border-white/10 p-4 flex items-center justify-between gap-4 mb-6"
      style={{ background: 'var(--color-surface)' }}
    >
      <div className="min-w-0">
        <div className="text-xs font-black uppercase tracking-widest"
             style={{ color: 'var(--color-accent)' }}>
          {tr('main_event')}
        </div>
        <Link href={`/tournaments/${tournament.slug}`}
              className="text-lg font-black text-white truncate block">
          {tournament.name}
        </Link>
      </div>
      {finished ? (
        <a
          data-testid="af-video"
          href={tournament.armfightVideoUrl!}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 px-4 py-2 rounded-md text-xs font-black uppercase tracking-wide text-white"
          style={{ background: 'var(--color-primary)' }}
        >
          {tr('watch_video')}
        </a>
      ) : (
        <div className="shrink-0">
          <Countdown targetIso={tournament.startDate} />
        </div>
      )}
    </div>
  );
}
