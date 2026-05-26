'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useArmfightBouts } from '@/hooks/useArmfight';
import { useBracketSocket } from '@/hooks/useBracketSocket';
import { Skeleton } from '@/components/ui/Skeleton';
import { Scoreboard } from './Scoreboard';
import { LegHistoryStrip } from './LegHistoryStrip';
import { LegInputPanel } from './LegInputPanel';
import { ForfeitDialog } from './ForfeitDialog';
import { WinnerCard } from './WinnerCard';
import type { BoutSnapshot } from './types';

interface Props {
  tournamentId: string;
  bracketId: string;
  boutId: string;
  isLocked: boolean;
}

export function BoutFocusView({
  tournamentId,
  bracketId,
  boutId,
  isLocked,
}: Props) {
  const t = useTranslations('operator_armfight');
  const { data: bouts, isLoading } = useArmfightBouts(bracketId);
  useBracketSocket(tournamentId);

  const [pendingWinner, setPendingWinner] = useState<
    BoutSnapshot['playerA'] | null
  >(null);
  const [forfeitOpen, setForfeitOpen] = useState(false);

  const backHref = `/operator/tournaments/${tournamentId}`;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-3">
        <Skeleton className="h-8 w-32 rounded-md" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  const bout = (bouts ?? []).find((b) => b.boutId === boutId);
  if (!bout) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center space-y-3">
        <p className="text-white font-bold">{t('error_bout_not_found')}</p>
        <Link href={backHref} className="underline text-sm"
          style={{ color: 'var(--color-text-secondary)' }}>
          {t('back_to_card')}
        </Link>
      </div>
    );
  }

  const winner =
    bout.status === 'completed' || bout.status === 'walkover'
      ? bout.scoreA > bout.scoreB
        ? bout.playerA
        : bout.playerB
      : null;

  const isTerminal = bout.status === 'completed' || bout.status === 'walkover';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm hover:text-white transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {t('back_to_card')}
        </Link>
        <span className="text-xs font-bold"
          style={{ color: 'var(--color-text-secondary)' }}>
          {t('bout_label', { n: bout.order })}
        </span>
      </div>

      {isLocked && (
        <div className="rounded-md p-3 text-xs border"
          style={{
            color: 'rgb(250, 204, 21)',
            backgroundColor: 'rgba(250,204,21,0.08)',
            borderColor: 'rgba(250,204,21,0.3)',
          }}>
          🔒 {t('bracket_locked')}
        </div>
      )}

      {isTerminal && winner ? (
        <WinnerCard
          winner={winner}
          scoreA={bout.scoreA}
          scoreB={bout.scoreB}
          status={bout.status as 'completed' | 'walkover'}
          walkoverReason={bout.walkoverReason}
          backHref={backHref}
        />
      ) : (
        <>
          <Scoreboard
            playerA={bout.playerA}
            playerB={bout.playerB}
            scoreA={bout.scoreA}
            scoreB={bout.scoreB}
            hand={bout.hand}
          />

          <LegHistoryStrip
            legs={bout.legs}
            playerA={bout.playerA}
            playerB={bout.playerB}
          />

          <div className="grid grid-cols-2 gap-3">
            {[bout.playerA, bout.playerB].map((p) => (
              <button
                key={p.id}
                type="button"
                disabled={isLocked}
                onClick={() => setPendingWinner(p)}
                className="rounded-2xl border-2 py-6 px-3 text-center transition-colors disabled:opacity-40"
                style={{
                  backgroundColor: 'var(--color-accent-dim)',
                  borderColor: 'var(--color-accent)',
                }}
              >
                <div className="font-black text-base text-white">
                  {p.firstName} {p.lastName}
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            disabled={isLocked}
            onClick={() => setForfeitOpen(true)}
            className="w-full rounded-md border py-3 text-sm font-bold transition-colors disabled:opacity-40"
            style={{
              color: 'var(--color-error)',
              borderColor: 'rgba(239,68,68,0.4)',
              backgroundColor: 'rgba(239,68,68,0.05)',
            }}
          >
            {t('forfeit_button')}
          </button>
        </>
      )}

      {pendingWinner && (
        <LegInputPanel
          bracketId={bracketId}
          boutId={bout.boutId}
          legIndex={bout.legs.length + 1}
          winner={pendingWinner}
          onClose={() => setPendingWinner(null)}
          onCommitted={() => setPendingWinner(null)}
        />
      )}

      {forfeitOpen && (
        <ForfeitDialog
          bracketId={bracketId}
          boutId={bout.boutId}
          boutOrder={bout.order}
          playerA={bout.playerA}
          playerB={bout.playerB}
          onClose={() => setForfeitOpen(false)}
          onCommitted={() => setForfeitOpen(false)}
        />
      )}
    </div>
  );
}
