'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { BoutSnapshot } from './types';

interface Props {
  bout: BoutSnapshot;
  tournamentId: string;
  isNextPending: boolean;
  locked: boolean;
}

export function BoutListItem({
  bout,
  tournamentId,
  isNextPending,
  locked,
}: Props) {
  const t = useTranslations('operator_armfight');
  const href = `/operator/tournaments/${tournamentId}/bouts/${bout.boutId}`;

  const playerAName = `${bout.playerA.firstName} ${bout.playerA.lastName}`.trim();
  const playerBName = `${bout.playerB.firstName} ${bout.playerB.lastName}`.trim();

  const winnerName =
    bout.scoreA > bout.scoreB ? playerAName : playerBName;

  let statusLine: React.ReactNode;
  switch (bout.status) {
    case 'pending':
      statusLine = t('status_pending');
      break;
    case 'in_progress':
      statusLine = (
        <>
          {t('status_in_progress')} ·{' '}
          <span className="tabular-nums">
            {bout.scoreA}:{bout.scoreB}
          </span>
        </>
      );
      break;
    case 'completed':
      statusLine = (
        <>
          ✓ {t('status_completed')} · {winnerName}{' '}
          <span className="tabular-nums">
            {bout.scoreA}:{bout.scoreB}
          </span>
        </>
      );
      break;
    case 'walkover':
      statusLine = (
        <>
          {t('status_walkover')} · {winnerName}
        </>
      );
      break;
  }

  return (
    <Link
      href={href}
      className="block rounded-2xl border p-4 transition-colors"
      style={{
        backgroundColor: 'var(--color-secondary)',
        borderColor: isNextPending
          ? 'var(--color-accent)'
          : 'rgba(255,255,255,0.08)',
        opacity: locked ? 0.7 : 1,
      }}
    >
      <div className="flex items-center justify-between gap-3 mb-1.5">
        <div className="flex items-center gap-2">
          <span
            className="bout-label text-xs font-black"
            data-order={bout.order}
            style={{ color: 'var(--color-text-secondary)' }}>
            {t('bout_label')}
          </span>
          <span
            className="px-1.5 py-0.5 rounded-full text-[10px] font-black"
            style={{
              color: 'var(--color-accent)',
              backgroundColor: 'var(--color-accent-dim)',
            }}
          >
            {bout.hand === 'left' ? 'L' : 'R'}
          </span>
        </div>
        {isNextPending && (
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-black"
            style={{
              color: 'var(--color-accent)',
              backgroundColor: 'var(--color-accent-dim)',
            }}
          >
            {t('next_pending_badge')}
          </span>
        )}
      </div>
      <div className="text-sm font-bold text-white mb-1">
        {playerAName} · {playerBName}
      </div>
      <div className="text-xs"
        style={{ color: 'var(--color-text-secondary)' }}>
        {statusLine}
      </div>
    </Link>
  );
}
