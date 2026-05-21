'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useResetBracket } from '@/hooks/useAdmin';
import type { Bracket, BracketMatch } from '@/types/api';

export interface PairsSummaryProps {
  tournamentId: string;
  bracket: Bracket;
  /** false in state 4 (completed/cancelled). */
  canRebuild: boolean;
}

function handLabelShort(r: unknown): string {
  const hand = (r as { hand?: unknown } | null)?.hand;
  return hand === 'left' ? 'L' : hand === 'right' ? 'R' : '—';
}

function fullName(p: BracketMatch['player1']): string {
  return `${p.firstName ?? '—'} ${p.lastName ?? ''}`.trim();
}

export function PairsSummary({ tournamentId, bracket, canRebuild }: PairsSummaryProps) {
  const t = useTranslations('armfight_pairs');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const reset = useResetBracket(tournamentId, bracket.id);
  const bouts = (bracket.bracketData?.winnersBracket?.[0] ?? []) as BracketMatch[];

  return (
    <div className="max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-[var(--color-text-primary)] mb-4">
        {t('pairs_title')}
      </h2>

      {!canRebuild && (
        <p className="mb-4 text-sm text-[var(--color-text-secondary)]">
          {t('readonly_completed_note')}
        </p>
      )}

      <ul className="space-y-2">
        {bouts.map((m, idx) => (
          <li
            key={m.id}
            className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-3 flex items-center justify-between gap-3"
          >
            <span className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
              {t('pair_label', { n: idx + 1 })}
            </span>
            <span className="text-sm text-[var(--color-text-primary)] flex-1 text-center">
              <strong>{fullName(m.player1)}</strong>
              <span className="mx-2 text-[var(--color-text-muted)]">vs</span>
              <strong>{fullName(m.player2)}</strong>
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-[var(--color-accent-dim)] text-[var(--color-accent)]">
              {handLabelShort(m.result)}
            </span>
          </li>
        ))}
      </ul>

      {canRebuild && (
        <div className="mt-8 rounded-md border border-[var(--color-error)] bg-[var(--color-error)]/10 p-4">
          <h3 className="text-sm font-bold text-[var(--color-error)] mb-1">
            {t('rebuild_title')}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            {t('rebuild_body')}
          </p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={reset.isPending}
            className="px-4 py-2 rounded-md text-sm font-bold bg-[var(--color-error)] text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
          >
            {t('rebuild_btn')}
          </button>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] p-6">
            <h3 className="text-base font-bold text-[var(--color-text-primary)] mb-2">
              {t('rebuild_confirm_title')}
            </h3>
            <p className="text-sm text-[var(--color-text-secondary)] mb-5">
              {t('rebuild_confirm_body')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={reset.isPending}
                className="px-4 py-2 rounded-md text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)]"
              >
                {t('rebuild_confirm_no')}
              </button>
              <button
                type="button"
                onClick={() => {
                  reset.mutate(undefined, { onSuccess: () => setConfirmOpen(false) });
                }}
                disabled={reset.isPending}
                className="px-4 py-2 rounded-md text-sm font-bold bg-[var(--color-error)] text-white hover:opacity-90 disabled:opacity-50"
              >
                {t('rebuild_confirm_yes')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
