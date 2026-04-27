'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAthletes, useVerifyAthlete, useSports } from '@/hooks/useAthletes';
import { Skeleton } from '@/components/ui/Skeleton';
import { CountryLabel } from '@/components/ui/CountryLabel';

export default function AdminAthletesPage() {
  const t = useTranslations('admin_athletes');
  const [search, setSearch] = useState('');
  const [sportFilter, setSportFilter] = useState('');
  const [page, setPage] = useState(1);

  const { data: sports } = useSports();
  const { data, isLoading, isError } = useAthletes({
    search: search || undefined,
    sport: sportFilter || undefined,
    page,
    limit: 20,
  });
  const verifyMutation = useVerifyAthlete();

  const totalPages = data?.meta.totalPages ?? 1;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">{t('page_title')}</h1>
          <p className="text-sm mt-1 text-[var(--color-text-secondary)]">
            {t('count', { count: data?.meta.total ?? 0 })}
          </p>
        </div>
        <Link
          href="/admin/athletes/new"
          className="px-4 py-2.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 bg-[var(--color-accent)] text-white"
        >
          {t('add_btn')}
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder={t('search_placeholder')}
          className="px-4 py-2.5 rounded-xl border border-white/15 bg-transparent text-white text-sm outline-none focus:border-[var(--color-accent)] transition-colors w-64"
        />
        <select
          value={sportFilter}
          onChange={(e) => {
            setSportFilter(e.target.value);
            setPage(1);
          }}
          className="px-4 py-2.5 rounded-xl border border-white/15 text-sm text-white outline-none bg-[var(--color-secondary)]"
        >
          <option value="">{t('all_sports')}</option>
          {sports?.map((s) => (
            <option key={s.id} value={s.slug}>
              {s.nameRu}
            </option>
          ))}
        </select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-center py-12 text-[var(--color-text-secondary)]">{t('error')}</p>
      ) : !data?.data.length ? (
        <div className="rounded-2xl border border-white/10 p-12 text-center bg-[var(--color-secondary)]">
          <p className="text-white font-semibold mb-2">{t('no_results')}</p>
          <Link
            href="/admin/athletes/new"
            className="px-5 py-2.5 rounded-xl font-bold text-sm inline-block mt-4 bg-[var(--color-accent)] text-white"
          >
            {t('add_first')}
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-[var(--color-secondary)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <th className="text-left px-5 py-3">{t('col_athlete')}</th>
                  <th className="text-left px-4 py-3">{t('col_sport')}</th>
                  <th className="text-left px-4 py-3">{t('col_country')}</th>
                  <th className="text-left px-4 py-3">{t('col_rank')}</th>
                  <th className="text-left px-4 py-3">{t('col_status')}</th>
                  <th className="text-right px-5 py-3">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.data.map((athlete) => (
                  <tr key={athlete.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-white/10 bg-white/5 flex items-center justify-center">
                          {athlete.photoUrl ? (
                            <Image
                              src={athlete.photoUrl}
                              alt={athlete.firstName}
                              width={36}
                              height={36}
                              className="object-cover w-full h-full"
                            />
                          ) : (
                            <span className="text-sm font-bold text-white">
                              {athlete.firstName[0]}
                            </span>
                          )}
                        </div>
                        <div>
                          <p className="font-semibold text-white text-sm">
                            {athlete.firstName} {athlete.lastName}
                          </p>
                          <p className="text-xs mt-0.5 text-[var(--color-text-secondary)]">
                            {athlete.gender === 'male' ? t('gender_male') : athlete.gender === 'female' ? t('gender_female') : ''}
                            {athlete.primaryHand === 'left'
                              ? ` · ${t('hand_left')}`
                              : athlete.primaryHand === 'right'
                                ? ` · ${t('hand_right')}`
                                : athlete.primaryHand === 'both'
                                  ? ` · ${t('hand_both')}`
                                  : ''}
                            {athlete.weight ? ` · ${athlete.weight} ${t('weight_unit')}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                      {athlete.sport?.nameRu ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--color-text-secondary)]">
                      <CountryLabel value={athlete.country} />
                    </td>
                    <td className="px-4 py-3">
                      {athlete.worldRank ? (
                        <span className="text-sm font-bold text-[var(--color-accent)]">
                          #{athlete.worldRank}
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--color-text-secondary)]">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {athlete.isVerified ? (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-[#22c55e20] text-[#22c55e]">
                          {t('verified')}
                        </span>
                      ) : (
                        <button
                          onClick={() => verifyMutation.mutate(athlete.id)}
                          disabled={verifyMutation.isPending}
                          className="text-xs px-2 py-0.5 rounded-full font-medium transition-colors bg-[#f59e0b20] text-[#f59e0b]"
                        >
                          {t('verify_btn')}
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/admin/athletes/${athlete.id}`}
                          className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors"
                        >
                          {t('edit_btn')}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white disabled:opacity-40 hover:bg-white/10"
              >
                ←
              </button>
              <span className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white disabled:opacity-40 hover:bg-white/10"
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
