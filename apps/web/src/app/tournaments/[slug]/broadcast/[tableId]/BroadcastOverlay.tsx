'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTournamentSchedule, useTournamentTables } from '@/hooks/useSchedule';
import { useBrackets } from '@/hooks/useTournaments';
import { Avatar } from '@/components/Avatar';
import type {
  Tournament,
  Bracket,
  BracketMatch,
  BracketPlayer,
} from '@/types/api';

export function BroadcastOverlay({
  tournament,
  tableId,
}: {
  tournament: Tournament;
  tableId: string;
}) {
  const t = useTranslations('broadcast');
  const params = useSearchParams();
  // `?bg=dark` for standalone viewing, `?bg=transparent` for OBS chroma-
  // free overlay on top of a video capture. Default is transparent —
  // the stream use-case is more common and "dark" is only useful as a
  // preview.
  const bg = params?.get('bg') === 'dark' ? 'dark' : 'transparent';

  // The global `body` CSS sets a dark background. For OBS to chroma-key
  // or layer this overlay cleanly we override to transparent on mount and
  // restore on unmount, so navigating away doesn't leave the rest of the
  // app styleless.
  useEffect(() => {
    if (bg !== 'transparent') return;
    const prev = document.body.style.backgroundColor;
    document.body.style.backgroundColor = 'transparent';
    return () => {
      document.body.style.backgroundColor = prev;
    };
  }, [bg]);

  const { data: tables } = useTournamentTables(tournament.id);
  const { data: schedule } = useTournamentSchedule(tournament.id);
  // 30s bracket poll to catch TBD → real-name propagation after a result.
  const { data: brackets } = useBrackets(tournament.id, { refetchInterval: 30_000 });

  const table = (tables ?? []).find((x) => x.id === tableId);
  const active = (schedule?.active ?? []).find((a) => a.tableId === tableId);
  const resolved = active ? findMatchAcross(brackets, active.matchId) : null;

  const rootStyle: React.CSSProperties =
    bg === 'dark'
      ? { backgroundColor: 'var(--color-primary)' }
      : { backgroundColor: 'transparent' };

  if (!table) {
    return (
      <div
        className="min-h-screen flex items-center justify-center text-white/70 text-xl"
        style={rootStyle}
      >
        {t('unknown_table')}
      </div>
    );
  }

  if (!active || !resolved) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center gap-3"
        style={rootStyle}
      >
        <p
          className="text-sm uppercase tracking-[0.3em]"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          {t('table_number', { n: table.number })}
          {table.name ? ` · ${table.name}` : ''}
        </p>
        <p className="text-3xl font-black text-white/80">{t('waiting')}</p>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-8"
      style={rootStyle}
    >
      {/* Category strip */}
      <div className="text-center">
        <p
          className="text-sm uppercase tracking-[0.3em]"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          {t('table_number', { n: table.number })}
          {resolved.bracketName ? ` · ${resolved.bracketName}` : ''}
        </p>
      </div>

      {/* Head-to-head */}
      <div className="flex items-center justify-center gap-10 w-full max-w-6xl">
        <PlayerPanel player={resolved.match.player1} align="right" />
        <div
          className="text-7xl font-black shrink-0"
          style={{ color: 'var(--color-accent)' }}
        >
          VS
        </div>
        <PlayerPanel player={resolved.match.player2} align="left" />
      </div>
    </div>
  );
}

function PlayerPanel({
  player,
  align,
}: {
  player: BracketPlayer;
  align: 'left' | 'right';
}) {
  const name = `${player.firstName ?? ''} ${player.lastName ?? ''}`.trim() || '—';
  return (
    <div
      className="flex-1 flex items-center gap-4"
      style={{ justifyContent: align === 'right' ? 'flex-end' : 'flex-start' }}
    >
      {align === 'right' && (
        <div style={{ textAlign: 'right' }}>
          <p
            className="text-5xl font-black leading-tight text-white"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
          >
            {name}
          </p>
          {player.seed ? (
            <p
              className="text-lg font-bold mt-2"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              #{player.seed}
            </p>
          ) : null}
        </div>
      )}

      {/* Reuse the shared <Avatar> (passes `unoptimized` so next/image does
          not try to proxy the API upload host — which is not in
          `remotePatterns`) + handles fallback initials for us. Accent
          ring + shadow to make it pop over a video feed. */}
      <div
        className="rounded-full shrink-0"
        style={{
          border: '4px solid var(--color-accent)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        }}
      >
        <Avatar
          src={player.photoUrl ?? null}
          firstName={player.firstName}
          lastName={player.lastName}
          size={112}
        />
      </div>

      {align === 'left' && (
        <div style={{ textAlign: 'left' }}>
          <p
            className="text-5xl font-black leading-tight text-white"
            style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
          >
            {name}
          </p>
          {player.seed ? (
            <p
              className="text-lg font-bold mt-2"
              style={{ color: 'rgba(255,255,255,0.6)' }}
            >
              #{player.seed}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

// ─── Bracket traversal helper ─────────────────────────────────────────────

interface ResolvedMatch {
  match: BracketMatch;
  bracketName: string | null;
}

function findMatchAcross(
  brackets: Bracket[] | undefined,
  matchId: string,
): ResolvedMatch | null {
  if (!brackets) return null;
  for (const b of brackets) {
    if (!b.bracketData) continue;
    const label = b.weightCategory?.name ?? b.name ?? null;
    const scan = (m: BracketMatch | undefined): ResolvedMatch | null => {
      if (!m) return null;
      return m.id === matchId ? { match: m, bracketName: label } : null;
    };

    for (const round of b.bracketData.winnersBracket) {
      for (const m of round) {
        const hit = scan(m);
        if (hit) return hit;
      }
    }
    for (const round of b.bracketData.losersBracket) {
      for (const m of round) {
        const hit = scan(m);
        if (hit) return hit;
      }
    }
    const gf = scan(b.bracketData.grandFinal);
    if (gf) return gf;
    if (b.bracketData.superFinal?.needed) {
      const sf = scan(b.bracketData.superFinal);
      if (sf) return sf;
    }
  }
  return null;
}
