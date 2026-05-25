'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ArmfightBoutStatus } from '@gsm/bracket-engine';

interface Props {
  winner: { id: string; firstName: string; lastName: string };
  scoreA: number;
  scoreB: number;
  status: Extract<ArmfightBoutStatus, 'completed' | 'walkover'>;
  walkoverReason: string | null;
  backHref: string;
}

export function WinnerCard({
  winner,
  scoreA,
  scoreB,
  status,
  walkoverReason,
  backHref,
}: Props) {
  const t = useTranslations('operator_armfight');
  const winnerName = `${winner.firstName} ${winner.lastName}`.trim();

  return (
    <div
      className="rounded-2xl border p-6 sm:p-10 text-center space-y-4"
      style={{
        backgroundColor: 'var(--color-secondary)',
        borderColor: 'rgba(255,255,255,0.08)',
      }}
    >
      <span className="text-5xl">🏆</span>

      {status === 'walkover' && (
        <div
          className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
          style={{
            color: 'var(--color-accent)',
            backgroundColor: 'var(--color-accent-dim)',
          }}
        >
          {t('winner_card_walkover_badge')}
        </div>
      )}

      <p className="text-2xl font-black text-white">
        {t('winner_card_title', { name: winnerName })}
      </p>

      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {t('winner_card_score', { scoreA, scoreB })}
      </p>

      {status === 'walkover' && walkoverReason && (
        <p
          className="text-sm italic"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {t('winner_card_walkover_reason', { reason: walkoverReason })}
        </p>
      )}

      <Link
        href={backHref}
        className="inline-block px-5 py-2.5 rounded-md text-sm font-bold border transition-colors"
        style={{
          color: 'var(--color-accent)',
          borderColor: 'rgba(255,255,255,0.15)',
        }}
      >
        {t('back_to_card')}
      </Link>
    </div>
  );
}
