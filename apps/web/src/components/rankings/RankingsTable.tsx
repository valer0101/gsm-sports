'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import type { RankingEntry } from '@/types/api';
import { TableRowSkeleton } from '@/components/ui/Skeleton';

interface RankingsTableProps {
  entries: RankingEntry[];
  isLoading?: boolean;
}

export function RankingsTable({ entries, isLoading }: RankingsTableProps) {
  const t = useTranslations('rankings');

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10">
      <table className="w-full text-sm">
        <thead>
          <tr
            className="border-b border-white/10"
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >
            <th className="px-4 py-3 text-left font-semibold text-white/60 w-12">{t('rank')}</th>
            <th className="px-4 py-3 text-left font-semibold text-white/60">{t('athlete')}</th>
            <th className="px-4 py-3 text-left font-semibold text-white/60 hidden sm:table-cell">
              {t('country')}
            </th>
            <th className="px-4 py-3 text-left font-semibold text-white/60 hidden md:table-cell">
              {t('hand')}
            </th>
            <th className="px-4 py-3 text-right font-semibold text-white/60">{t('points')}</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, i) => <TableRowSkeleton key={i} cols={5} />)
          ) : entries.length === 0 ? (
            <tr>
              <td
                colSpan={5}
                className="px-4 py-12 text-center"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('no_results')}
              </td>
            </tr>
          ) : (
            entries.map((entry, idx) => (
              <tr
                key={entry.id}
                className="border-b border-white/5 transition-colors hover:bg-white/3"
                style={{
                  backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                }}
              >
                {/* Rank */}
                <td className="px-4 py-3">
                  <span
                    className={`font-bold ${entry.worldPosition === 1 ? 'text-yellow-400' : entry.worldPosition === 2 ? 'text-gray-300' : entry.worldPosition === 3 ? 'text-amber-600' : 'text-white/40'}`}
                  >
                    {entry.worldPosition ?? '—'}
                  </span>
                </td>

                {/* Athlete */}
                <td className="px-4 py-3">
                  <Link
                    href={`/athletes/${entry.athlete?.slug}`}
                    className="flex items-center gap-3 hover:text-white transition-colors"
                  >
                    <div
                      className="w-8 h-8 rounded-full overflow-hidden border border-white/10 flex items-center justify-center shrink-0"
                      style={{ backgroundColor: 'var(--color-background)' }}
                    >
                      {entry.athlete?.photoUrl ? (
                        <Image
                          src={entry.athlete.photoUrl}
                          alt=""
                          width={32}
                          height={32}
                          className="object-cover"
                        />
                      ) : (
                        <span className="text-xs font-bold text-white/40">
                          {entry.athlete?.firstName?.[0]}
                          {entry.athlete?.lastName?.[0]}
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-white">
                      {entry.athlete?.firstName} {entry.athlete?.lastName}
                    </span>
                  </Link>
                </td>

                {/* Country */}
                <td
                  className="px-4 py-3 hidden sm:table-cell"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {entry.country ?? '—'}
                </td>

                {/* Hand */}
                <td
                  className="px-4 py-3 hidden md:table-cell"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {entry.hand ? t(entry.hand as 'left' | 'right') : '—'}
                </td>

                {/* Points */}
                <td
                  className="px-4 py-3 text-right font-semibold"
                  style={{ color: 'var(--color-accent)' }}
                >
                  {entry.points.toLocaleString()}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
