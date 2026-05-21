'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useGenerateArmfightBracket, type ConfirmedEntry } from '@/hooks/useAdmin';
import { PairRow } from './PairRow';
import { freshDraft, draftToPayload, type PairDraft } from './types';

export interface PairBuilderProps {
  tournamentId: string;
  confirmedEntries: ConfirmedEntry[];
}

function labelForEntry(e: ConfirmedEntry): string {
  const name = `${e.user?.firstName ?? '—'} ${e.user?.lastName ?? ''}`.trim();
  const kg = e.weightKg != null ? `${e.weightKg}kg` : '?kg';
  const hand = e.hand === 'left' ? 'L' : e.hand === 'right' ? 'R' : '—';
  return `${name} · ${kg} · ${hand}`;
}

export function PairBuilder({ tournamentId, confirmedEntries }: PairBuilderProps) {
  const t = useTranslations('armfight_pairs');
  const router = useRouter();
  const [pairs, setPairs] = useState<PairDraft[]>(() => [freshDraft()]);
  const generate = useGenerateArmfightBracket(tournamentId);

  const completePayloads = useMemo(
    () => pairs.map(draftToPayload).filter((p): p is NonNullable<typeof p> => p !== null),
    [pairs],
  );
  const incompleteIndex = pairs.findIndex((p) => draftToPayload(p) === null);
  const usedPlayerCount = completePayloads.length * 2;
  const unpairedCount = Math.max(0, confirmedEntries.length - usedPlayerCount);

  const canSubmit =
    !generate.isPending &&
    completePayloads.length >= 1 &&
    incompleteIndex === -1;

  const onSubmit = () => {
    if (!canSubmit) return;
    generate.mutate(
      { pairs: completePayloads },
      {
        onSuccess: () => {
          router.push(`/admin/tournaments/${tournamentId}`);
        },
      },
    );
  };

  const errorMessage =
    generate.isError
      ? ((generate.error as any)?.response?.data?.message
          ?? (generate.error as any)?.message
          ?? 'error')
      : null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-6">
      {/* Roster — read-only */}
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-2">
          {t('roster_title')}
        </div>
        <div className="text-sm text-[var(--color-text-secondary)] mb-3">
          {t('roster_count', { n: confirmedEntries.length })}
        </div>
        <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] divide-y divide-[var(--color-border)]">
          {confirmedEntries.map((e) => (
            <div key={e.id} className="px-3 py-2 text-sm text-[var(--color-text-primary)]">
              {labelForEntry(e)}
            </div>
          ))}
        </div>
      </div>

      {/* Pairs */}
      <div className="space-y-4">
        <div className="text-xs font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
          {t('pairs_count', { n: pairs.length })}
        </div>

        {pairs.map((p, idx) => (
          <PairRow
            key={p.id}
            index={idx}
            entries={confirmedEntries}
            value={p}
            onChange={(next) => setPairs(pairs.map((x) => (x.id === p.id ? next : x)))}
            onRemove={() => setPairs(pairs.filter((x) => x.id !== p.id))}
            disabled={generate.isPending}
          />
        ))}

        <button
          type="button"
          onClick={() => setPairs([...pairs, freshDraft()])}
          disabled={generate.isPending}
          className="px-4 py-2 rounded-md text-sm font-semibold text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {t('add_pair')}
        </button>

        {/* Warnings */}
        {incompleteIndex !== -1 && (
          <div className="text-sm text-[var(--color-error)]">
            {t('incomplete_pair_warning', { n: incompleteIndex + 1 })}
          </div>
        )}
        {unpairedCount > 0 && (
          <div className="text-sm text-[var(--color-warning)]">
            <span aria-hidden="true">⚠ </span>
            <span>{t('unpaired_warning', { n: unpairedCount })}</span>
          </div>
        )}
        {errorMessage && (
          <div className="text-sm text-[var(--color-error)] whitespace-pre-wrap">
            {errorMessage}
          </div>
        )}

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit}
          className="w-full sm:w-auto px-6 py-3 rounded-md text-sm font-bold uppercase tracking-wide bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {generate.isPending ? t('submitting') : t('submit')}
        </button>
      </div>
    </div>
  );
}
