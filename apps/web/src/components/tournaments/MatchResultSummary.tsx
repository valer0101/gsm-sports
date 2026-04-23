'use client';

import { useTranslations } from 'next-intl';
import type { MatchResult } from '@/types/api';

/**
 * Compact read-only render of a match's sport-specific result detail
 * (Phase 3.2). Shown below the winner row on the public bracket and the
 * arena / broadcast views. Switches on `result.schema` and produces at
 * most a one-liner chip — the full detail lives behind the operator
 * form, not in every bracket card.
 *
 * `null` / missing result → returns `null` so callers don't need to guard.
 */
export function MatchResultSummary({
  result,
}: {
  result: Record<string, unknown> | null | undefined;
}) {
  const t = useTranslations('match_result');

  if (!result || typeof result !== 'object') return null;
  const r = result as unknown as MatchResult;

  switch (r.schema) {
    case 'armwrestling': {
      const victoryLabelKey: Record<typeof r.victoryType, string> = {
        pin: 'aw_pin',
        points: 'aw_points',
        fouls: 'aw_fouls',
        dq: 'aw_dq',
      };
      const victory = t(victoryLabelKey[r.victoryType]);
      const foulTotal = sumFouls(r.fouls);
      return (
        <Chip
          text={
            foulTotal > 0
              ? t('aw_summary_with_fouls', { victory, fouls: foulTotal })
              : victory
          }
        />
      );
    }
    case 'score': {
      return (
        <Chip
          text={t('score_summary', {
            player1: r.finalPlayer1,
            player2: r.finalPlayer2,
          })}
        />
      );
    }
    case 'points': {
      if (!r.cards || r.cards.length === 0) return null;
      // Average across judge cards — common combat-sport summary line.
      const avg1 = avg(r.cards.map((c) => c.player1));
      const avg2 = avg(r.cards.map((c) => c.player2));
      return <Chip text={t('points_summary', { player1: avg1, player2: avg2 })} />;
    }
    case 'time': {
      return (
        <Chip
          text={t('time_summary', {
            player1: formatMs(r.player1Ms),
            player2: formatMs(r.player2Ms),
          })}
        />
      );
    }
    case 'simple_winner':
      return null;
    default: {
      const _exhaustive: never = r;
      void _exhaustive;
      return null;
    }
  }
}

function Chip({ text }: { text: string }) {
  return (
    <span
      className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{
        color: 'var(--color-text-secondary)',
        backgroundColor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
      }}
    >
      {text}
    </span>
  );
}

function sumFouls(fouls: Record<string, number> | undefined): number {
  if (!fouls) return 0;
  return Object.values(fouls).reduce((acc, v) => acc + (Number(v) || 0), 0);
}

function avg(xs: number[]): number {
  if (xs.length === 0) return 0;
  return Math.round(xs.reduce((a, b) => a + b, 0) / xs.length);
}

function formatMs(ms: number): string {
  if (ms >= 60000) {
    const mins = Math.floor(ms / 60000);
    const secs = ((ms % 60000) / 1000).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}
