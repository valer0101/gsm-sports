'use client';

import { useTranslations } from 'next-intl';
import { useArmfightBouts } from '@/hooks/useArmfight';
import { useBracketSocket } from '@/hooks/useBracketSocket';
import { Skeleton } from '@/components/ui/Skeleton';
import { BoutListItem } from './BoutListItem';
import type { Bracket } from '@/types/api';

interface Props {
  tournamentId: string;
  bracket: Bracket;
}

export function ArmfightFightCard({ tournamentId, bracket }: Props) {
  const t = useTranslations('operator_armfight');
  const { data: bouts, isLoading } = useArmfightBouts(bracket.id);
  useBracketSocket(tournamentId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  const list = (bouts ?? []).slice().sort((a, b) => a.order - b.order);
  const anyClosed = list.some(
    (b) => b.status === 'completed' || b.status === 'walkover',
  );
  const nextPendingId = anyClosed
    ? (list.find((b) => b.status === 'pending')?.boutId ?? null)
    : null;

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-xl font-black text-white">{t('card_title')}</h2>
        <p className="text-xs"
          style={{ color: 'var(--color-text-secondary)' }}>
          {t('card_subtitle', { n: list.length })}
        </p>
      </div>

      {bracket.isLocked && (
        <div className="rounded-md p-3 text-xs border"
          style={{
            color: 'rgb(250, 204, 21)',
            backgroundColor: 'rgba(250,204,21,0.08)',
            borderColor: 'rgba(250,204,21,0.3)',
          }}>
          🔒 <span>{t('bracket_locked')}</span>
        </div>
      )}

      {list.map((bout) => (
        <BoutListItem
          key={bout.boutId}
          bout={bout}
          tournamentId={tournamentId}
          isNextPending={bout.boutId === nextPendingId}
          locked={bracket.isLocked}
        />
      ))}
    </div>
  );
}
