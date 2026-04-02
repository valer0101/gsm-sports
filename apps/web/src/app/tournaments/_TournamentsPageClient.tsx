'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { TournamentCard } from '@/components/tournaments/TournamentCard';
import { TournamentCardSkeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { useTournaments } from '@/hooks/useTournaments';
import type { PaginatedResponse, Tournament } from '@/types/api';

const STATUSES = ['', 'upcoming', 'active', 'completed'] as const;

interface Props {
  initialData?: PaginatedResponse<Tournament>;
  sport?: string;
}

export function TournamentsPageClient({ initialData, sport }: Props) {
  const t = useTranslations('tournaments');
  const tCommon = useTranslations('common');

  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading, isError } = useTournaments(
    { status: status || undefined, sport, page, limit: 12 },
    { initialData: status === '' && page === 1 ? initialData : undefined },
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">{t('title')}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('subtitle')}
        </p>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-8 flex-wrap">
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setStatus(s);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              status === s ? 'text-white' : 'text-white/50 hover:text-white/80'
            }`}
            style={
              status === s
                ? { backgroundColor: 'var(--color-primary)' }
                : { backgroundColor: 'rgba(255,255,255,0.05)' }
            }
          >
            {s === '' ? t('all') : t(s as any)}
          </button>
        ))}
      </div>

      {/* Grid */}
      {isError ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
          {tCommon('error')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => <TournamentCardSkeleton key={i} />)
            ) : data?.data.length === 0 ? (
              <div
                className="col-span-full text-center py-16"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('no_results')}
              </div>
            ) : (
              data?.data.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))
            )}
          </div>

          {data?.meta && (
            <Pagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          )}
        </>
      )}
    </div>
  );
}
