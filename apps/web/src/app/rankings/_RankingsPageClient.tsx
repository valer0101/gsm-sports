'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { RankingsTable } from '@/components/rankings/RankingsTable';
import { Pagination } from '@/components/ui/Pagination';
import { useWorldRankings, useCountryRankings } from '@/hooks/useRankings';
import type { PaginatedResponse, RankingEntry } from '@/types/api';

const CURRENT_YEAR = new Date().getFullYear();
const SEASONS = [CURRENT_YEAR, CURRENT_YEAR - 1, CURRENT_YEAR - 2];

type View = 'world' | 'country';

interface Props {
  initialData?: PaginatedResponse<RankingEntry>;
  sport?: string;
}

export function RankingsPageClient({ initialData, sport }: Props) {
  const t = useTranslations('rankings');

  const [view, setView] = useState<View>('world');
  const [country, setCountry] = useState('Armenia');
  const [season, setSeason] = useState<number | undefined>(undefined);
  const [hand, setHand] = useState('');
  const [gender, setGender] = useState('');
  const [page, setPage] = useState(1);

  const params = { sport, season, hand: hand || undefined, gender: gender || undefined, page, limit: 50 };

  const isDefaultWorldQuery = view === 'world' && !season && !hand && !gender && page === 1;

  const worldQuery = useWorldRankings(
    view === 'world' ? params : { limit: 0 },
    { initialData: isDefaultWorldQuery ? initialData : undefined },
  );
  const countryQuery = useCountryRankings(
    view === 'country' ? country : '',
    view === 'country' ? params : {},
  );

  const { data, isLoading } = view === 'world' ? worldQuery : countryQuery;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-white">{t('title')}</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('subtitle')}
        </p>
      </div>

      {/* View tabs */}
      <div className="flex gap-2 mb-6">
        {(['world', 'country'] as View[]).map((v) => (
          <button
            key={v}
            onClick={() => { setView(v); setPage(1); }}
            className="px-5 py-2 rounded-lg text-sm font-medium transition-colors"
            style={
              view === v
                ? { backgroundColor: 'var(--color-primary)', color: 'white' }
                : { backgroundColor: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }
            }
          >
            {v === 'world' ? t('world_title') : t('country_title')}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        {view === 'country' && (
          <input
            type="text"
            value={country}
            onChange={(e) => { setCountry(e.target.value); setPage(1); }}
            placeholder={t('filter_country')}
            className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-white text-sm focus:outline-none focus:border-white/30 w-40"
          />
        )}

        <select
          value={season ?? ''}
          onChange={(e) => { setSeason(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}
          className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-sm focus:outline-none"
          style={{ color: season ? 'white' : 'rgba(255,255,255,0.4)' }}
        >
          <option value="">{t('filter_season')}</option>
          {SEASONS.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        <select
          value={hand}
          onChange={(e) => { setHand(e.target.value); setPage(1); }}
          className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-sm focus:outline-none"
          style={{ color: hand ? 'white' : 'rgba(255,255,255,0.4)' }}
        >
          <option value="">{t('filter_hand')}</option>
          <option value="right">{t('right')}</option>
          <option value="left">{t('left')}</option>
        </select>

        <select
          value={gender}
          onChange={(e) => { setGender(e.target.value); setPage(1); }}
          className="px-4 py-2 rounded-lg border border-white/15 bg-white/5 text-sm focus:outline-none"
          style={{ color: gender ? 'white' : 'rgba(255,255,255,0.4)' }}
        >
          <option value="">{t('filter_gender')}</option>
          <option value="male">{t('male')}</option>
          <option value="female">{t('female')}</option>
        </select>
      </div>

      {/* Table */}
      <RankingsTable entries={data?.data ?? []} isLoading={isLoading} />

      {data?.meta && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  );
}
