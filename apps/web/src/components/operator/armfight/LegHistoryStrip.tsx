'use client';

import { useTranslations } from 'next-intl';
import type { LegWinType } from '@gsm/bracket-engine';

interface Leg {
  index: number;
  winnerId: string;
  winType: LegWinType;
}

interface Props {
  legs: Leg[];
  playerA: { id: string; firstName: string };
  playerB: { id: string; firstName: string };
}

const WINTYPE_ICON: Record<LegWinType, string> = {
  pin: '✊',
  foul: '⛔',
  dq: '❌',
};

export function LegHistoryStrip({ legs, playerA, playerB }: Props) {
  const t = useTranslations('operator_armfight');
  const byIndex = new Map(legs.map((l) => [l.index, l]));

  return (
    <div className="space-y-2">
      <div className="text-xs uppercase tracking-wider"
        style={{ color: 'var(--color-text-secondary)' }}>
        {t('leg_history_title')}
      </div>
      <div className="grid grid-cols-5 gap-1.5">
        {[1, 2, 3, 4, 5].map((i) => {
          const leg = byIndex.get(i);
          const playerInitial = leg
            ? leg.winnerId === playerA.id
              ? playerA.firstName.charAt(0)
              : playerB.firstName.charAt(0)
            : '';
          return (
            <div
              key={i}
              data-leg-slot
              className="rounded-lg border text-center p-2 text-sm"
              style={{
                backgroundColor: leg
                  ? 'var(--color-secondary)'
                  : 'transparent',
                borderColor: leg
                  ? 'rgba(255,255,255,0.15)'
                  : 'rgba(255,255,255,0.05)',
                opacity: leg ? 1 : 0.4,
              }}
            >
              <div className="text-[10px]" style={{ color: 'var(--color-text-secondary)' }}>
                {i}
              </div>
              {leg && (
                <div className="flex items-center justify-center gap-1">
                  <span className="font-black text-white">{playerInitial}</span>
                  <span className="text-xs">{WINTYPE_ICON[leg.winType]}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="text-[11px] italic" style={{ color: 'var(--color-text-secondary)' }}>
        {t('leg_history_correction_hint')}
      </p>
    </div>
  );
}
