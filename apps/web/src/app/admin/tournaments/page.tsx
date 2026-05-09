'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminTournaments, useDeleteTournament } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Tournament } from '@/types/api';

export default function AdminTournamentsPage() {
  const t = useTranslations('admin');
  const { data: tournaments, isLoading, isError } = useAdminTournaments();
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

  // Same status palette as the detail page header — semantic CE tokens.
  const statusStyle = (status: string): { bg: string; fg: string } => {
    switch (status) {
      case 'upcoming': return { bg: 'rgba(59,130,246,0.14)', fg: '#60a5fa' };
      case 'registration_open': return { bg: 'rgba(34,197,94,0.14)', fg: 'var(--color-success)' };
      case 'registration_closed': return { bg: 'rgba(245,158,11,0.14)', fg: 'var(--color-warning)' };
      case 'bracket_ready': return { bg: 'rgba(255,215,0,0.14)', fg: 'var(--color-accent)' };
      case 'active': return { bg: 'var(--color-primary-dim)', fg: 'var(--color-primary)' };
      case 'draft':
      case 'completed':
      case 'cancelled':
      default:
        return { bg: 'rgba(106,106,128,0.16)', fg: 'var(--color-text-muted)' };
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="flex items-start justify-between gap-3 mb-6 sm:mb-8 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tight">
            {t('tournaments_title')}
          </h1>
          <p className="text-sm mt-1 text-[var(--color-text-secondary)]">
            {t('tournaments_subtitle')}
          </p>
        </div>
        <Link
          href="/admin/tournaments/new"
          className="px-4 py-2.5 rounded-md font-bold text-sm bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors shrink-0"
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
      ) : isError ? (
        <p className="text-center py-12 text-[var(--color-text-secondary)]">
          {t('error')}
        </p>
      ) : !tournaments?.length ? (
        <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 sm:p-12 text-center">
          <p className="text-[var(--color-text-primary)] font-semibold mb-2">{t('empty_title')}</p>
          <p className="text-sm mb-6 text-[var(--color-text-secondary)]">
            {t('empty_desc')}
          </p>
          <Link
            href="/admin/tournaments/new"
            className="inline-block px-5 py-2.5 rounded-md font-bold text-sm bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            {t('create_btn')}
          </Link>
        </div>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {tournaments.map((tour) => (
              <TournamentCard
                key={tour.id}
                tour={tour}
                statusLabel={statusLabel}
                statusStyle={statusStyle}
                deleteConfirm={deleteConfirm}
                setDeleteConfirm={setDeleteConfirm}
                onDelete={() =>
                  deleteMutation.mutate(tour.id, {
                    onSuccess: () => setDeleteConfirm(null),
                  })
                }
                t={t}
              />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  <th className="text-left px-5 py-3 font-bold">{t('col_tournament')}</th>
                  <th className="text-left px-4 py-3 font-bold">{t('col_date')}</th>
                  <th className="text-left px-4 py-3 font-bold">{t('col_status')}</th>
                  <th className="text-right px-5 py-3 font-bold">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--color-border)]">
                {tournaments.map((tour) => {
                  const { bg, fg } = statusStyle(tour.status);
                  return (
                    <tr key={tour.id} className="hover:bg-[var(--color-surface-2)] transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-[var(--color-text-primary)]">{tour.name}</p>
                        {tour.location && (
                          <p className="text-xs mt-0.5 text-[var(--color-text-secondary)]">
                            {tour.location}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                        {new Date(tour.startDate).toLocaleDateString('ru-RU')}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className="text-[10px] uppercase tracking-[0.12em] px-2.5 py-1 rounded-full font-bold"
                          style={{ backgroundColor: bg, color: fg }}
                        >
                          {statusLabel(tour.status)}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <Link
                            href={`/admin/tournaments/${tour.id}`}
                            className="text-sm px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
                          >
                            {t('manage_btn')}
                          </Link>
                          {!['active', 'completed', 'cancelled'].includes(tour.status) &&
                            (deleteConfirm === tour.id ? (
                              <div className="flex gap-1">
                                <button
                                  onClick={() =>
                                    deleteMutation.mutate(tour.id, {
                                      onSuccess: () => setDeleteConfirm(null),
                                    })
                                  }
                                  className="text-xs px-2.5 py-1.5 rounded-md bg-[var(--color-error)]/20 text-[var(--color-error)] hover:bg-[var(--color-error)]/30 transition-colors"
                                >
                                  {t('confirm_delete')}
                                </button>
                                <button
                                  onClick={() => setDeleteConfirm(null)}
                                  className="text-xs px-2.5 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                                >
                                  {t('cancel_delete')}
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteConfirm(tour.id)}
                                className="text-xs px-3 py-1.5 rounded-md text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
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
        </>
      )}
    </div>
  );
}

function TournamentCard({
  tour,
  statusLabel,
  statusStyle,
  deleteConfirm,
  setDeleteConfirm,
  onDelete,
  t,
}: {
  tour: Tournament;
  statusLabel: (s: string) => string;
  statusStyle: (s: string) => { bg: string; fg: string };
  deleteConfirm: string | null;
  setDeleteConfirm: (v: string | null) => void;
  onDelete: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const { bg, fg } = statusStyle(tour.status);
  const canDelete = !['active', 'completed', 'cancelled'].includes(tour.status);
  return (
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[var(--color-text-primary)] truncate">{tour.name}</p>
          {tour.location && (
            <p className="text-xs mt-0.5 text-[var(--color-text-secondary)] truncate">
              {tour.location}
            </p>
          )}
          <p className="text-xs mt-1 text-[var(--color-text-muted)]">
            {new Date(tour.startDate).toLocaleDateString('ru-RU')}
          </p>
        </div>
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-full font-bold shrink-0"
          style={{ backgroundColor: bg, color: fg }}
        >
          {statusLabel(tour.status)}
        </span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/admin/tournaments/${tour.id}`}
          className="flex-1 min-w-0 text-center text-sm px-3 py-2 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          {t('manage_btn')}
        </Link>
        {canDelete && (
          deleteConfirm === tour.id ? (
            <div className="flex gap-1 w-full">
              <button
                onClick={onDelete}
                className="flex-1 text-xs px-3 py-2 rounded-md bg-[var(--color-error)]/20 text-[var(--color-error)] hover:bg-[var(--color-error)]/30 font-bold transition-colors"
              >
                {t('confirm_delete')}
              </button>
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 text-xs px-3 py-2 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {t('cancel_delete')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => setDeleteConfirm(tour.id)}
              className="text-sm px-3 py-2 rounded-md text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors shrink-0"
              aria-label={t('delete_btn')}
            >
              {t('delete_btn')}
            </button>
          )
        )}
      </div>
    </div>
  );
}
