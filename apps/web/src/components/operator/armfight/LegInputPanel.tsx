'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { LegWinType } from '@gsm/bracket-engine';
import { useRecordLeg } from '@/hooks/useArmfight';

interface Props {
  bracketId: string;
  boutId: string;
  legIndex: number;
  winner: { id: string; firstName: string; lastName: string };
  onClose: () => void;
  onCommitted: () => void;
}

const WIN_TYPES: LegWinType[] = ['pin', 'foul', 'dq'];

export function LegInputPanel({
  bracketId,
  boutId,
  legIndex,
  winner,
  onClose,
  onCommitted,
}: Props) {
  const t = useTranslations('operator_armfight');
  const [winType, setWinType] = useState<LegWinType>('pin');
  const recordLeg = useRecordLeg(bracketId);
  const winnerName = `${winner.firstName} ${winner.lastName}`.trim();

  const serverMessage =
    recordLeg.error &&
    (recordLeg.error as any)?.response?.data?.message
      ? String((recordLeg.error as any).response.data.message)
      : null;

  const onConfirm = () => {
    recordLeg.mutate(
      { boutId, legIndex, winnerId: winner.id, winType },
      { onSuccess: () => onCommitted() },
    );
  };

  return (
    <div
      role="dialog"
      aria-label={t('leg_input_title', { name: winnerName, n: legIndex })}
      className="fixed inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center z-50"
    >
      <div
        className="absolute inset-0"
        style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />
      <div
        className="relative rounded-t-2xl sm:rounded-2xl border p-5 sm:max-w-md sm:w-full mx-0 sm:mx-4 space-y-4"
        style={{
          backgroundColor: 'var(--color-secondary)',
          borderColor: 'rgba(255,255,255,0.1)',
        }}
      >
        <h2 className="text-base font-black text-white">
          {t('leg_input_title', { name: winnerName, n: legIndex })}
        </h2>

        <div className="grid grid-cols-3 gap-2">
          {WIN_TYPES.map((wt) => (
            <label
              key={wt}
              className="cursor-pointer rounded-lg border py-3 text-center text-sm font-bold transition-colors"
              style={{
                backgroundColor:
                  winType === wt
                    ? 'var(--color-accent-dim)'
                    : 'transparent',
                borderColor:
                  winType === wt
                    ? 'var(--color-accent)'
                    : 'rgba(255,255,255,0.15)',
                color: winType === wt ? 'var(--color-accent)' : 'white',
              }}
            >
              <input
                type="radio"
                name="winType"
                value={wt}
                checked={winType === wt}
                onChange={() => setWinType(wt)}
                className="sr-only"
                aria-label={t(`wintype_${wt}` as `wintype_${LegWinType}`)}
              />
              {t(`wintype_${wt}` as `wintype_${LegWinType}`)}
            </label>
          ))}
        </div>

        {serverMessage && (
          <div
            role="alert"
            className="rounded-md p-3 text-sm border"
            style={{
              color: 'var(--color-error)',
              backgroundColor: 'rgba(239,68,68,0.08)',
              borderColor: 'rgba(239,68,68,0.3)',
            }}
          >
            <div className="font-bold mb-1">{t('error_recordleg_prefix')}</div>
            <div>{serverMessage}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={recordLeg.isPending}
            className="px-4 py-3 rounded-md text-sm font-bold border disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'white' }}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={recordLeg.isPending}
            className="px-4 py-3 rounded-md text-sm font-bold border disabled:opacity-40"
            style={{
              backgroundColor: 'var(--color-accent)',
              borderColor: 'var(--color-accent)',
              color: 'black',
            }}
          >
            {t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
