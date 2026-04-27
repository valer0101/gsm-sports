'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useOperatorTournaments } from '@/hooks/useOperator';
import { Skeleton } from '@/components/ui/Skeleton';
import { CountryLabel } from '@/components/ui/CountryLabel';

export default function OperatorPage() {
  const t = useTranslations('operator');
  const { data: tournaments, isLoading, isError } = useOperatorTournaments();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">{t('title')}</h1>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          {t('error')}
        </p>
      ) : !tournaments?.length ? (
        <div
          className="rounded-2xl border border-white/10 p-12 text-center"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <p className="text-white font-semibold mb-1">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((tour) => (
            <Link
              key={tour.id}
              href={`/operator/tournaments/${tour.id}`}
              className="flex items-center justify-between rounded-2xl border border-white/10 p-5 hover:border-white/20 transition-colors"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <div>
                <p className="font-bold text-white">{tour.name}</p>
                <p
                  className="text-sm mt-0.5 inline-flex items-center gap-1.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {tour.city && <span>{tour.city}{tour.country ? ',' : ''}</span>}
                  {tour.country && <CountryLabel value={tour.country} />}
                  {(tour.city || tour.country) && <span>·</span>}
                  <span>{new Date(tour.startDate).toLocaleDateString('ru-RU')}</span>
                </p>
              </div>
              <div className="flex items-center gap-3">
                {tour.bracketGenerated && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400">
                    {t('bracket_ready')}
                  </span>
                )}
                <svg
                  className="w-5 h-5 text-white/30"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
