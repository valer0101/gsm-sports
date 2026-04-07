'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminTournaments, useDeleteTournament } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminPage() {
  const t = useTranslations('admin');
  const { data: tournaments, isLoading } = useAdminTournaments();
  const deleteMutation = useDeleteTournament();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const statusLabel = (status: string) => {
    const key = `status_${status}` as Parameters<typeof t>[0];
    try {
      return t(key);
    } catch {
      return status;
    }
  };

  const STATUS_COLOR: Record<string, string> = {
    draft: '#6b7280',
    upcoming: '#3b82f6',
    registration_open: '#22c55e',
    registration_closed: '#f59e0b',
    bracket_ready: '#a855f7',
    active: '#ef4444',
    completed: '#6b7280',
    cancelled: '#6b7280',
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">{t('title')}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            {t('subtitle')}
          </p>
        </div>
        <Link
          href="/admin/tournaments/new"
          className="px-4 py-2.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
        >
          {t('new_tournament')}
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !tournaments?.length ? (
        <div
          className="rounded-2xl border border-white/10 p-12 text-center"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <p className="text-white font-semibold mb-2">{t('empty_title')}</p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            {t('empty_desc')}
          </p>
          <Link
            href="/admin/tournaments/new"
            className="px-5 py-2.5 rounded-xl font-bold text-sm"
            style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
          >
            {t('create_btn')}
          </Link>
        </div>
      ) : (
        <div
          className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <table className="w-full">
            <thead>
              <tr
                className="border-b border-white/10 text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <th className="text-left px-5 py-3">{t('col_tournament')}</th>
                <th className="text-left px-4 py-3">{t('col_date')}</th>
                <th className="text-left px-4 py-3">{t('col_status')}</th>
                <th className="text-right px-5 py-3">{t('col_actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tournaments.map((tour) => {
                const color = STATUS_COLOR[tour.status] ?? '#6b7280';
                return (
                  <tr key={tour.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{tour.name}</p>
                      {tour.location && (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {tour.location}
                        </p>
                      )}
                    </td>
                    <td
                      className="px-4 py-4 text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {new Date(tour.startDate).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ backgroundColor: color + '20', color }}
                      >
                        {statusLabel(tour.status)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/admin/tournaments/${tour.id}`}
                          className="text-sm px-3 py-1.5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors"
                        >
                          {t('manage_btn')}
                        </Link>
                        {!['active', 'completed', 'cancelled'].includes(tour.status) &&
                          (deleteConfirm === tour.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  deleteMutation.mutate(tour.id, {
                                    onSuccess: () => setDeleteConfirm(null),
                                  });
                                }}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                              >
                                {t('confirm_delete')}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                {t('cancel_delete')}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(tour.id)}
                              className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              {t('delete_btn')}
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
