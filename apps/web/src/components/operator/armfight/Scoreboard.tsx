'use client';

import { useTranslations } from 'next-intl';
import type { ArmfightHand } from '@gsm/bracket-engine';

interface Props {
  playerA: { id: string; firstName: string; lastName: string };
  playerB: { id: string; firstName: string; lastName: string };
  scoreA: number;
  scoreB: number;
  hand: ArmfightHand;
}

export function Scoreboard({ playerA, playerB, scoreA, scoreB, hand }: Props) {
  const t = useTranslations('operator_armfight');
  return (
    <div
      className="rounded-2xl border p-4 sm:p-6"
      style={{
        backgroundColor: 'var(--color-secondary)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <div className="text-center text-xs uppercase tracking-wider mb-2"
        style={{ color: 'var(--color-text-secondary)' }}>
        <span
          className="inline-block px-2 py-0.5 rounded-full text-[10px] font-black"
          style={{
            color: 'var(--color-accent)',
            backgroundColor: 'var(--color-accent-dim)',
          }}
        >
          {hand === 'left' ? t('hand_left') : t('hand_right')}
        </span>
      </div>
      <div className="grid grid-cols-3 items-center gap-2">
        <div className="text-right">
          <div className="text-sm font-bold text-white truncate">
            {playerA.firstName} {playerA.lastName}
          </div>
        </div>
        <div className="text-center font-black tabular-nums text-5xl sm:text-6xl text-white">
          <span>{scoreA}</span>
          <span className="px-2 opacity-50">:</span>
          <span>{scoreB}</span>
        </div>
        <div className="text-left">
          <div className="text-sm font-bold text-white truncate">
            {playerB.firstName} {playerB.lastName}
          </div>
        </div>
      </div>
    </div>
  );
}
