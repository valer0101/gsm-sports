import { Icon } from '../_lib/icons';
import type { Prize, PrizeType } from '../_lib/types';
import { PRIZE_TYPE_LABELS } from '../_lib/constants';

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
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
        <select
          value={prize.type}
          onChange={(e) => {
            const t = e.target.value as PrizeType;
            // Switching type clears the irrelevant field to avoid sending money's
            // amount alongside a trophy.
            onUpdate({
              type: t,
              ...(t === 'money' ? { description: '' } : { amount: '' }),
            });
          }}
          className="h-10 px-3 bg-[var(--color-background)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none rounded text-sm"
        >
          {PRIZE_TYPE_IDS.map((id) => (
            <option key={id} value={id}>{PRIZE_TYPE_LABELS[id]}</option>
          ))}
        </select>
        {prize.type === 'money' ? (
          <div className="relative">
            <input
              type="number"
              min="0"
              value={prize.amount || ''}
              onChange={(e) => onUpdate({ amount: e.target.value })}
              placeholder="100000"
              className="w-full h-10 pl-3 pr-12 font-mono bg-[var(--color-background)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none rounded text-sm [color-scheme:dark]"
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[var(--color-text-muted)] pointer-events-none">AMD</div>
          </div>
        ) : (
          <input
            type="text"
            value={prize.description || ''}
            onChange={(e) => onUpdate({ description: e.target.value })}
            placeholder={
              prize.type === 'medal' ? 'Gold medal'
              : prize.type === 'trophy' ? 'Champion trophy'
              : prize.type === 'certificate' ? 'Certificate of achievement'
              : 'Describe the prize...'
            }
            className="w-full h-10 px-3 bg-[var(--color-background)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:outline-none rounded text-sm"
          />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="flex-shrink-0 h-10 w-10 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary-dim)] rounded-md transition-colors"
        aria-label="Remove reward"
      >
        {Icon.trash()}
      </button>
    </div>
  );
}
