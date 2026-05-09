'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '../_lib/icons';
import type { Prize, PrizeType } from '../_lib/types';

const PRIZE_TYPE_IDS: PrizeType[] = ['money', 'medal', 'trophy', 'certificate', 'custom'];

/**
 * Single reward row — used inside a PlaceGroup.
 * The place number lives on the group, not the row.
 */
export function PrizeRow({
  prize,
  onUpdate,
  onRemove,
}: {
  prize: Prize;
  onUpdate: (patch: Partial<Prize>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations('tournament_wizard');

  const typeLabel = (id: PrizeType) =>
    t(`prize_type_${id}` as 'prize_type_money' | 'prize_type_medal' | 'prize_type_trophy' | 'prize_type_certificate' | 'prize_type_custom');

  const placeholderForType = (type: PrizeType): string => {
    switch (type) {
      case 'medal': return t('prize_medal_placeholder');
      case 'trophy': return t('prize_trophy_placeholder');
      case 'certificate': return t('prize_certificate_placeholder');
      default: return t('prize_custom_placeholder');
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
        <select
          value={prize.type}
          onChange={(e) => {
            const next = e.target.value as PrizeType;
            // Switching type clears the irrelevant field to avoid sending money's
            // amount alongside a trophy.
            onUpdate({
              type: next,
              ...(next === 'money' ? { description: '' } : { amount: '' }),
            });
          }}
          className="h-10 px-3 bg-[var(--color-background)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none rounded text-sm"
        >
          {PRIZE_TYPE_IDS.map((id) => (
            <option key={id} value={id}>{typeLabel(id)}</option>
          ))}
        </select>
        {prize.type === 'money' ? (
          <div className="relative">
            <input
              type="number"
              min="0"
              value={prize.amount || ''}
              onChange={(e) => onUpdate({ amount: e.target.value })}
              placeholder={t('prize_money_placeholder')}
              className="w-full h-10 pl-3 pr-12 font-mono bg-[var(--color-background)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none rounded text-sm [color-scheme:dark]"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--color-text-muted)] pointer-events-none">{t('amd_suffix')}</div>
          </div>
        ) : (
          <input
            type="text"
            value={prize.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder={placeholderForType(prize.type)}
            className="w-full h-10 px-3 bg-[var(--color-background)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none rounded text-sm"
          />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex-shrink-0 h-10 w-10 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-dim)] rounded-md transition-colors"
        aria-label={t('prize_remove_reward')}
      >
        {Icon.trash()}
      </button>
    </div>
  );
}
