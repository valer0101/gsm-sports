'use client';

import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Icon } from '../_lib/icons';
import type { Prize, ReviewData, EntryFeeType } from '../_lib/types';

export function ReviewBlock({
  review,
  prizes,
  entryFeeType,
  entryFeeAmount,
  totalMoneyPrize,
  goToStep,
}: {
  review: ReviewData;
  prizes: Prize[];
  entryFeeType: EntryFeeType;
  entryFeeAmount: string;
  maxParticipants: string;
  totalMoneyPrize: number;
  goToStep: (n: number) => void;
}) {
  const t = useTranslations('tournament_wizard');
  const locale = useLocale();
  const dashes = '—';

  const dateLabel = (() => {
    if (!review.startDate) return dashes;
    const d = new Date(review.startDate);
    if (isNaN(d.getTime())) return review.startDate;
    return d.toLocaleDateString(locale, { month: 'short', day: 'numeric', year: 'numeric' });
  })();
  const locationLabel = [review.venue, review.city, review.country].filter(Boolean).join(', ') || dashes;
  const compTypeLabel = review.competitionType === 'setka'
    ? t('comp_setka_title')
    : review.competitionType === 'armfight'
    ? t('comp_armfight_title')
    : dashes;
  const handLabel = review.hand === 'both'
    ? t('hand_both')
    : review.hand === 'right'
    ? t('hand_right')
    : review.hand === 'left'
    ? t('hand_left')
    : dashes;
  const entryFeeLabel = entryFeeType === 'free'
    ? t('entry_fee_free')
    : entryFeeAmount
    ? `${parseFloat(entryFeeAmount).toLocaleString()} ${t('amd_suffix')}`
    : t('entry_fee_paid');
  const prizePoolLabel = totalMoneyPrize > 0
    ? `${totalMoneyPrize.toLocaleString()} ${t('amd_suffix')}`
    : prizes.length > 0
    ? t(prizes.length === 1 ? 'review_n_prizes_one' : 'review_n_prizes_other', { count: prizes.length })
    : dashes;

  return (
    <div className="bg-gradient-to-br from-[var(--color-surface)] to-[var(--color-background)] border-2 border-[var(--color-primary)]/40 rounded-[10px] overflow-hidden">
      <div className="px-5 py-3 bg-[var(--color-primary-dim)] border-b border-[var(--color-primary)]/30 flex items-center gap-2">
        {Icon.star('h-3.5 w-3.5')}
        <span className="text-[11px] tracking-[0.12em] uppercase font-semibold text-[var(--color-primary)]">{t('review_title')}</span>
      </div>
      <div className="p-6 flex gap-5">
        <div className="flex-shrink-0">
          {review.poster ? (
            <div className="relative w-32 h-20 rounded-md border border-[var(--color-border)] overflow-hidden">
              <Image
                src={review.poster}
                alt={t('poster_label')}
                fill
                sizes="128px"
                unoptimized
                className="object-cover"
              />
            </div>
          ) : (
            <div className="w-32 h-20 bg-[var(--color-surface-2)] border border-dashed border-[var(--color-border)] rounded-md flex items-center justify-center text-[var(--color-text-muted)]">
              {Icon.imagePlus('h-5 w-5')}
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-2xl font-extrabold tracking-tight truncate">{review.name || t('review_untitled')}</div>
          <div className="text-sm text-[var(--color-text-secondary)] mt-0.5 flex items-center gap-2 flex-wrap">
            <span>{review.sportEmoji} {review.sportName || t('review_no_sport')}</span>
            <span className="text-[var(--color-text-muted)]">·</span>
            <span className="text-[var(--color-primary)] font-semibold">{compTypeLabel}</span>
          </div>
          <div className="text-xs text-[var(--color-text-secondary)] mt-1 flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1">{Icon.calendar()} {dateLabel}</span>
            <span className="flex items-center gap-1">{Icon.pin()} {locationLabel}</span>
          </div>
        </div>
      </div>

      <div className="px-6 grid grid-cols-2 md:grid-cols-4 gap-px bg-[var(--color-border)] mx-6 rounded overflow-hidden">
        <Stat label={t('review_stat_categories')} value={String(review.categoryCount)} />
        <Stat label={t('review_stat_hand')} value={handLabel} />
        <Stat label={t('review_stat_entry_fee')} value={entryFeeLabel} />
        <Stat label={t('review_stat_prize_pool')} value={prizePoolLabel} />
      </div>

      <div className="p-6 flex flex-wrap gap-2">
        <EditChip onClick={() => goToStep(1)} label={t('review_edit_basics')} />
        <EditChip onClick={() => goToStep(2)} label={t('review_edit_format')} />
        <EditChip onClick={() => goToStep(3)} label={t('review_edit_categories')} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[var(--color-surface)] px-4 py-3">
      <div className="text-[10px] uppercase tracking-[0.1em] text-[var(--color-text-muted)] font-semibold">{label}</div>
      <div className="text-sm font-semibold mt-0.5 truncate">{value}</div>
    </div>
  );
}

function EditChip({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-3 py-1.5 text-xs font-semibold text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border)] hover:border-[var(--color-primary)] rounded transition-colors flex items-center gap-1.5"
    >
      {Icon.pencil('h-3 w-3')}
      {label}
    </button>
  );
}
