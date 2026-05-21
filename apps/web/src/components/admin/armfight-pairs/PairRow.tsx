'use client';

import { useTranslations } from 'next-intl';
import type { ConfirmedEntry } from '@/hooks/useAdmin';
import type { PairDraft } from './types';

export interface PairRowProps {
  /** 0-based; UI displays index + 1. */
  index: number;
  /** All confirmed entries (no client-side filtering). */
  entries: ConfirmedEntry[];
  value: PairDraft;
  onChange: (next: PairDraft) => void;
  onRemove: () => void;
  /** During submit. */
  disabled?: boolean;
}

function labelForEntry(e: ConfirmedEntry): string {
  const name = `${e.user?.firstName ?? '—'} ${e.user?.lastName ?? ''}`.trim();
  const kg = e.weightKg != null ? `${e.weightKg}kg` : '?kg';
  const hand = e.hand === 'left' ? 'L' : e.hand === 'right' ? 'R' : '—';
  return `${name} · ${kg} · ${hand}`;
}

export function PairRow({ index, entries, value, onChange, onRemove, disabled }: PairRowProps) {
  const t = useTranslations('armfight_pairs');
  const baseSelectClass =
    'h-10 px-3 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-primary)] disabled:opacity-50';

  return (
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          {t('pair_label', { n: index + 1 })}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={t('remove_pair')}
          className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-error)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          🗑
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px] gap-2 items-center">
        <select
          value={value.playerAId}
          onChange={(e) => onChange({ ...value, playerAId: e.target.value })}
          disabled={disabled}
          className={baseSelectClass}
        >
          <option value="">{t('select_player_placeholder')}</option>
          {entries.map((e) => (
            <option key={e.id} value={e.id}>{labelForEntry(e)}</option>
          ))}
        </select>

        <select
          value={value.playerBId}
          onChange={(e) => onChange({ ...value, playerBId: e.target.value })}
          disabled={disabled}
          className={baseSelectClass}
        >
          <option value="">{t('select_player_placeholder')}</option>
          {entries.map((e) => (
            <option key={e.id} value={e.id}>{labelForEntry(e)}</option>
          ))}
        </select>

        <select
          value={value.hand}
          onChange={(e) => onChange({ ...value, hand: e.target.value as 'left' | 'right' | '' })}
          disabled={disabled}
          className={baseSelectClass}
        >
          <option value="">{t('select_hand_placeholder')}</option>
          <option value="left">{t('hand_left')}</option>
          <option value="right">{t('hand_right')}</option>
        </select>
      </div>
    </div>
  );
}
