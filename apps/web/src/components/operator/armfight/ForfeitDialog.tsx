'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useForfeitBout } from '@/hooks/useArmfight';

interface Props {
  bracketId: string;
  boutId: string;
  boutOrder: number;
  playerA: { id: string; firstName: string; lastName: string };
  playerB: { id: string; firstName: string; lastName: string };
  onClose: () => void;
  onCommitted: () => void;
}

export function ForfeitDialog({
  bracketId,
  boutId,
  boutOrder,
  playerA,
  playerB,
  onClose,
  onCommitted,
}: Props) {
  const t = useTranslations('operator_armfight');
  const [winnerId, setWinnerId] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const forfeit = useForfeitBout(bracketId);

  const serverMessage =
    forfeit.error && (forfeit.error as any)?.response?.data?.message
      ? String((forfeit.error as any).response.data.message)
      : null;

  const onConfirm = () => {
    if (!winnerId) return;
    const trimmed = reason.trim();
    forfeit.mutate(
      {
        boutId,
        winnerId,
        ...(trimmed ? { walkoverReason: trimmed } : {}),
      },
      { onSuccess: () => onCommitted() },
    );
  };

  const players = [playerA, playerB];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('forfeit_dialog_title', { n: boutOrder })}
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
          {t('forfeit_dialog_title', { n: boutOrder })}
        </h2>

        <fieldset className="space-y-2">
          <legend
            className="text-xs uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('forfeit_dialog_winner_label')}
          </legend>
          {players.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-3 cursor-pointer rounded-md p-3 border"
              style={{
                borderColor:
                  winnerId === p.id
                    ? 'var(--color-accent)'
                    : 'rgba(255,255,255,0.1)',
                backgroundColor:
                  winnerId === p.id ? 'var(--color-accent-dim)' : 'transparent',
              }}
            >
              <input
                type="radio"
                name="forfeit-winner"
                checked={winnerId === p.id}
                onChange={() => setWinnerId(p.id)}
                aria-label={`${p.firstName} ${p.lastName}`}
              />
              <span className="text-sm font-bold text-white">
                {p.firstName} {p.lastName}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-1">
          <label
            className="text-xs uppercase tracking-wider"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('forfeit_dialog_reason_label')}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('forfeit_dialog_reason_placeholder')}
            rows={3}
            className="w-full rounded-md border bg-transparent p-2 text-sm text-white"
            style={{ borderColor: 'rgba(255,255,255,0.15)' }}
          />
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
            <div className="font-bold mb-1">{t('error_forfeit_prefix')}</div>
            <div>{serverMessage}</div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={forfeit.isPending}
            className="px-4 py-3 rounded-md text-sm font-bold border disabled:opacity-40"
            style={{ borderColor: 'rgba(255,255,255,0.15)', color: 'white' }}
          >
            {t('cancel')}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!winnerId || forfeit.isPending}
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
