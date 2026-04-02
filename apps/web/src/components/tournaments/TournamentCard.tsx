import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { Tournament } from '@/types/api';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-white/10 text-white/50',
  upcoming: 'bg-blue-500/20 text-blue-300',
  active: 'bg-green-500/20 text-green-300',
  completed: 'bg-white/10 text-white/50',
  cancelled: 'bg-red-500/20 text-red-300',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface TournamentCardProps {
  tournament: Tournament;
}

export function TournamentCard({ tournament }: TournamentCardProps) {
  const t = useTranslations('tournaments');

  const statusColor = STATUS_COLORS[tournament.status] ?? 'bg-white/10 text-white/50';

  return (
    <Link
      href={`/tournaments/${tournament.slug}`}
      className="block rounded-xl border border-white/10 p-5 transition-all hover:border-white/25 hover:-translate-y-0.5"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="font-semibold text-white leading-tight line-clamp-2">{tournament.name}</h3>
        <span className={`shrink-0 text-xs font-medium px-2 py-1 rounded-full ${statusColor}`}>
          {t(tournament.status as any) || tournament.status}
        </span>
      </div>

      {/* Meta */}
      <div className="space-y-1.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <span>{formatDate(tournament.startDate)}</span>
          {tournament.endDate && <span>— {formatDate(tournament.endDate)}</span>}
        </div>

        {(tournament.city || tournament.country) && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
            <span>{[tournament.city, tournament.country].filter(Boolean).join(', ')}</span>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 mt-4 flex-wrap">
        {tournament.sport && (
          <span
            className="text-xs px-2 py-1 rounded-full border border-white/15"
            style={{ color: 'var(--color-accent)' }}
          >
            {tournament.sport.nameRu}
          </span>
        )}
        {tournament.registrationOpen && (
          <span className="text-xs px-2 py-1 rounded-full bg-green-500/15 text-green-300">
            {t('registration_open')}
          </span>
        )}
        {tournament.isLive && (
          <span className="text-xs px-2 py-1 rounded-full bg-red-500/20 text-red-300 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            LIVE
          </span>
        )}
      </div>
    </Link>
  );
}
