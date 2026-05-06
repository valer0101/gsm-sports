import { Icon } from '../_lib/icons';
import type { Prize } from '../_lib/types';
import { PrizeRow } from './PrizeRow';

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

/**
 * Card for a single place (1st, 2nd, ...). Holds one or more rewards
 * — money, trophy, certificate, etc. Place number is shown once at the
 * top; each reward inside is a PrizeRow without its own badge.
 */
export function PlaceGroup({
  place,
  rewards,
  onUpdateReward,
  onRemoveReward,
  onAddReward,
  onRemovePlace,
}: {
  place: number;
  rewards: Prize[];
  onUpdateReward: (id: string, patch: Partial<Prize>) => void;
  onRemoveReward: (id: string) => void;
  onAddReward: () => void;
  onRemovePlace: () => void;
}) {
  const placeBadgeClass =
    place === 1 ? 'bg-[var(--color-accent)] text-black'
    : place === 2 ? 'bg-[#C0C0C0] text-black'
    : place === 3 ? 'bg-[#CD7F32] text-white'
    : 'bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-secondary)]';

  const accentLine =
    place === 1 ? 'bg-[var(--color-accent)]'
    : place === 2 ? 'bg-[#C0C0C0]'
    : place === 3 ? 'bg-[#CD7F32]'
    : 'bg-[var(--color-border-strong)]';

  return (
    <div className="relative bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md overflow-hidden">
      {/* Accent stripe on the left edge for visual hierarchy */}
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${accentLine}`} />

      <div className="pl-5 pr-4 py-4 space-y-3">
        {/* Place header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex-shrink-0 h-9 w-9 rounded-full flex items-center justify-center font-mono font-bold text-sm ${placeBadgeClass}`}>
              {place}
            </div>
            <div>
              <div className="text-sm font-bold">{ordinal(place)} place</div>
              <div className="text-[11px] text-[var(--color-text-muted)]">
                {rewards.length} reward{rewards.length === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onRemovePlace}
            className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
            aria-label={`Remove ${ordinal(place)} place`}
            title={`Remove ${ordinal(place)} place`}
          >
            {Icon.trash()}
          </button>
        </div>

        {/* Rewards */}
        <div className="space-y-2">
          {rewards.map((r) => (
            <PrizeRow
              key={r.id}
              prize={r}
              onUpdate={(patch) => onUpdateReward(r.id, patch)}
              onRemove={() => onRemoveReward(r.id)}
            />
          ))}
        </div>

        {/* Add another reward */}
        <button
          type="button"
          onClick={onAddReward}
          className="w-full py-2 flex items-center justify-center gap-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-white border border-dashed border-[var(--color-border)] hover:border-[var(--color-border-strong)] rounded transition-colors"
        >
          {Icon.plus('h-3.5 w-3.5')}
          Add reward to {ordinal(place)} place
        </button>
      </div>
    </div>
  );
}
