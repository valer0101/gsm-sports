'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { AthleteCard } from '@/components/athletes/AthleteCard';
import { AthleteCardSkeleton } from '@/components/ui/Skeleton';
import { Pagination } from '@/components/ui/Pagination';
import { useAthletes } from '@/hooks/useAthletes';
import type { PaginatedResponse, Athlete } from '@/types/api';

interface Props {
  initialData?: PaginatedResponse<Athlete>;
  sport?: string;
}

export function AthletesPageClient({ initialData, sport }: Props) {
  const t = useTranslations('athletes');
  const tCommon = useTranslations('common');

  const [search, setSearch] = useState('');
  const [gender, setGender] = useState('');
  const [hand, setHand] = useState('');
  const [page, setPage] = useState(1);
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const handleSearch = (value: string) => {
    setSearch(value);
    clearTimeout((handleSearch as any)._timer);
    (handleSearch as any)._timer = setTimeout(() => {
      setDebouncedSearch(value);
      setPage(1);
    }, 400);
  };

  const isDefaultQuery = !debouncedSearch && !gender && !hand && page === 1;

  const { data, isLoading, isError } = useAthletes(
    { search: debouncedSearch || undefined, gender: gender || undefined, hand: hand || undefined, sport, page, limit: 20 },
    { initialData: isDefaultQuery ? initialData : undefined },
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <input
          type="text"
          placeholder={t('search_placeholder')}
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-white placeholder-white/30 focus:outline-none focus:border-white/30 text-sm"
        />

        <select
          value={gender}
          onChange={(e) => { setGender(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-sm focus:outline-none focus:border-white/30"
          style={{ color: gender ? 'white' : 'rgba(255,255,255,0.4)' }}
        >
          <option value="">{t('filter_gender')}</option>
          <option value="male">{t('male')}</option>
          <option value="female">{t('female')}</option>
        </select>

        <select
          value={hand}
          onChange={(e) => { setHand(e.target.value); setPage(1); }}
          className="px-4 py-2.5 rounded-lg border border-white/15 bg-white/5 text-sm focus:outline-none focus:border-white/30"
          style={{ color: hand ? 'white' : 'rgba(255,255,255,0.4)' }}
        >
          <option value="">{t('filter_hand')}</option>
          <option value="right">{t('right_hand')}</option>
          <option value="left">{t('left_hand')}</option>
          <option value="both">{t('both_hands')}</option>
        </select>

        {(gender || hand || search) && (
          <button
            onClick={() => { setGender(''); setHand(''); setSearch(''); setDebouncedSearch(''); setPage(1); }}
            className="px-4 py-2.5 rounded-lg text-sm border border-white/15 hover:bg-white/5 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {tCommon('reset')}
          </button>
        )}
      </div>

      {/* Results */}
      {isError ? (
        <div className="text-center py-16" style={{ color: 'var(--color-text-secondary)' }}>
          {tCommon('error')}
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => <AthleteCardSkeleton key={i} />)
            ) : data?.data.length === 0 ? (
              <div
                className="col-span-full text-center py-16"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('no_results')}
              </div>
            ) : (
              data?.data.map((athlete) => <AthleteCard key={athlete.id} athlete={athlete} />)
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
