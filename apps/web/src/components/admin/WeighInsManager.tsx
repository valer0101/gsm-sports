'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useConfirmedEntries, type ConfirmedEntry } from '@/hooks/useAdmin';
import {
  useAdminWeighIns,
  useAdminRecordWeighIn,
  useAdminUndoWeighIn,
} from '@/hooks/useWeighIns';
import { Skeleton } from '@/components/ui/Skeleton';
import type { WeighInResponse } from '@/types/api';

/**
 * Admin/organizer section on the tournament page that records on-site
 * weigh-ins for all confirmed / checked-in athletes. Only rendered for
 * sports whose `SportConfig.weighInRequired` is true (armwrestling,
 * boxing, mma, jiu_jitsu by default).
 *
 * Per entry the row is one of two states:
 *   - no weigh-in yet → inline weight input + "Record" button
 *   - already weighed → measured weight + "Undo" button (admin only)
 *
 * A progress banner at the top counts how many are done. When every
 * athlete is weighed-in, the banner flips green and the
 * `onAllWeighedIn` callback fires so the parent can unlock the
 * "Generate bracket" button.
 */
export function WeighInsManager({
  tournamentId,
  canUndo,
  highlightEntryIds,
}: {
  tournamentId: string;
  /** Admin role — organizers see the undo button disabled. */
  canUndo: boolean;
  /** Entry ids the bracket-generation gate flagged as unweighed — rendered with a red ring so the organizer knows exactly whom to measure next. */
  highlightEntryIds?: string[];
}) {
  const t = useTranslations('admin_weigh_ins');
  const tReg = useTranslations('admin_tournament');
  const { data: entriesRes, isLoading: entriesLoading } = useConfirmedEntries(tournamentId);
  const { data: weighIns, isLoading: weighInsLoading } = useAdminWeighIns(tournamentId);
  const record = useAdminRecordWeighIn(tournamentId);
  const undo = useAdminUndoWeighIn(tournamentId);

  const weighInByEntryId = useMemo(() => {
    const map = new Map<string, WeighInResponse>();
    (weighIns ?? []).forEach((w) => map.set(w.entryId, w));
    return map;
  }, [weighIns]);

  const entries = entriesRes?.data ?? [];
  const weighedCount = entries.filter((e) => weighInByEntryId.has(e.id)).length;
  const total = entries.length;

  const highlightSet = useMemo(
    () => new Set(highlightEntryIds ?? []),
    [highlightEntryIds],
  );

  if (entriesLoading || weighInsLoading) {
    return <Skeleton className="h-24 w-full rounded-xl" />;
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {t('no_entries')}
      </p>
    );
  }

  const allDone = total > 0 && weighedCount === total;

  return (
    <div className="space-y-3">
      {/* Progress banner */}
      <div
        className="rounded-xl px-4 py-3 text-sm flex items-center justify-between gap-3 flex-wrap"
        style={{
          backgroundColor: allDone ? 'rgba(16,185,129,0.10)' : 'rgba(59,130,246,0.08)',
          border: `1px solid ${allDone ? 'rgba(16,185,129,0.25)' : 'rgba(59,130,246,0.2)'}`,
          color: allDone ? '#86efac' : '#93c5fd',
        }}
      >
        <span className="font-semibold">
          {allDone
            ? t('progress_done')
            : t('progress_status', { done: weighedCount, total })}
        </span>
        {!allDone && (
          <span className="text-xs opacity-80">{t('progress_gate_hint')}</span>
        )}
      </div>

      {/* Per-entry rows */}
      <div className="space-y-2">
        {entries.map((entry) => (
          <WeighInRow
            key={entry.id}
            entry={entry}
            weighIn={weighInByEntryId.get(entry.id) ?? null}
            highlighted={highlightSet.has(entry.id)}
            canUndo={canUndo}
            recordState={{
              isPending: record.isPending && record.variables?.entryId === entry.id,
              // `record.error` is shared across all rows of the table — only
              // surface it on the row whose mutation actually failed.
              // Otherwise a failed record on row A would leak its error
              // message into rows B, C, … on the next render.
              error:
                record.variables?.entryId === entry.id ? record.error : null,
            }}
            onRecord={(kg) =>
              record.mutate({ entryId: entry.id, officialWeightKg: kg })
            }
            onUndo={(id) => undo.mutate(id)}
            isUndoing={undo.isPending && undo.variables === weighInByEntryId.get(entry.id)?.id}
            t={t}
            tReg={tReg}
          />
        ))}
      </div>
    </div>
  );
}

function WeighInRow({
  entry,
  weighIn,
  highlighted,
  canUndo,
  recordState,
  onRecord,
  onUndo,
  isUndoing,
  t,
  tReg,
}: {
  entry: ConfirmedEntry;
  weighIn: WeighInResponse | null;
  highlighted: boolean;
  canUndo: boolean;
  recordState: { isPending: boolean; error: unknown };
  onRecord: (kg: number) => void;
  onUndo: (weighInId: string) => void;
  isUndoing: boolean;
  t: ReturnType<typeof useTranslations>;
  tReg: ReturnType<typeof useTranslations>;
}) {
  const [input, setInput] = useState<string>('');
  const pName =
    `${entry.user?.firstName ?? ''} ${entry.user?.lastName ?? ''}`.trim() || '—';

  const parsedKg = input.trim() === '' ? NaN : Number(input);
  const isValidInput =
    Number.isFinite(parsedKg) && parsedKg > 0 && parsedKg <= 500;

  const borderColor = highlighted
    ? 'rgba(239,68,68,0.45)'
    : weighIn
      ? 'rgba(16,185,129,0.25)'
      : 'rgba(255,255,255,0.08)';

  return (
    <div
      className="rounded-xl border p-3"
      style={{
        borderColor,
        backgroundColor: highlighted ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.02)',
      }}
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm text-white font-medium">{pName}</p>
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {entry.ageGroup ?? '—'} · {entry.hand ?? '—'}
            {entry.weightKg ? ` · ${t('registered_kg', { kg: entry.weightKg })}` : ''}
          </p>
        </div>

        {weighIn ? (
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-black px-2 py-1 rounded-full"
              style={{ color: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)' }}
            >
              ✓ {t('official_kg', { kg: Number(weighIn.officialWeightKg) })}
            </span>
            {canUndo && (
              <button
                disabled={isUndoing}
                onClick={() => onUndo(weighIn.id)}
                className="text-xs px-2 py-1 rounded-lg border transition-colors disabled:opacity-50"
                style={{
                  borderColor: 'rgba(239,68,68,0.3)',
                  color: '#f87171',
                }}
              >
                {isUndoing ? '…' : tReg('undo_checkin_btn')}
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="500"
              step="0.1"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={t('weight_placeholder')}
              className="w-24 px-2 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none focus:border-[var(--color-accent)]"
            />
            <button
              disabled={!isValidInput || recordState.isPending}
              onClick={() => {
                if (!isValidInput) return;
                onRecord(parsedKg);
                setInput('');
              }}
              className="text-xs px-3 py-1.5 rounded-lg font-bold transition-opacity disabled:opacity-40"
              style={{
                backgroundColor: 'var(--color-accent)',
                color: 'white',
              }}
            >
              {recordState.isPending ? '…' : t('record_btn')}
            </button>
          </div>
        )}
      </div>

      {recordState.error ? (
        <p className="mt-2 text-xs text-red-400">
          {(recordState.error as { response?: { data?: { message?: string } } })
            ?.response?.data?.message ?? t('generic_error')}
        </p>
      ) : null}
    </div>
  );
}
