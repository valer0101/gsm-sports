'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useOperatorTournaments } from '@/hooks/useOperator';
import { Skeleton } from '@/components/ui/Skeleton';

export default function OperatorPage() {
  const t = useTranslations('operator');
  const { data: tournaments, isLoading } = useOperatorTournaments();

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
      ) : !tournaments?.length ? (
        <div
          className="rounded-2xl border border-white/10 p-12 text-center"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <p className="text-white font-semibold mb-1">{t('empty')}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/operator/tournaments/${t.id}`}
              className="flex items-center justify-between rounded-2xl border border-white/10 p-5 hover:border-white/20 transition-colors"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <div>
                <p className="font-bold text-white">{t.name}</p>
                <p className="text-sm mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {[t.city, t.country].filter(Boolean).join(', ')} ·{' '}
                  {new Date(t.startDate).toLocaleDateString('ru-RU')}
                </p>
              </div>
              <div className="flex items-center gap-3">
                {t.bracketGenerated && (
                  <span className="text-xs px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-400">
                    Сетка готова
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
