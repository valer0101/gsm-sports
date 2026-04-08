'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useBrackets } from '@/hooks/useTournaments';
import { useBracketSocket } from '@/hooks/useBracketSocket';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Bracket, BracketMatch } from '@/types/api';

interface Props {
  tournamentId: string;
}

export function BracketView({ tournamentId }: Props) {
  const t = useTranslations('tournaments');
  const { data: brackets, isLoading, isError } = useBrackets(tournamentId);
  const [selectedBracketIdx, setSelectedBracketIdx] = useState(0);

  // Subscribe to real-time updates via Socket.io
  useBracketSocket(tournamentId);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (isError || !brackets) {
    return (
      <p className="text-center py-10" style={{ color: 'var(--color-text-secondary)' }}>
        {t('bracket_error')}
      </p>
    );
  }

  if (brackets.length === 0) {
    return (
      <p className="text-center py-10" style={{ color: 'var(--color-text-secondary)' }}>
        {t('bracket_not_ready')}
      </p>
    );
  }

  const bracket = brackets[selectedBracketIdx];
  const bd = bracket.bracketData;

  return (
    <div>
      {/* Category tabs (if multiple brackets) */}
      {brackets.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          {brackets.map((b, idx) => (
            <button
              key={b.id}
              onClick={() => setSelectedBracketIdx(idx)}
              className="shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors"
              style={{
                borderColor:
                  idx === selectedBracketIdx ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                color:
                  idx === selectedBracketIdx
                    ? 'var(--color-accent)'
                    : 'var(--color-text-secondary)',
                backgroundColor:
                  idx === selectedBracketIdx ? 'var(--color-accent-dim)' : 'transparent',
              }}
            >
              {b.weightCategory?.name ?? `${t('bracket')} ${idx + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Bracket scroll area */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-max">
          {/* Winners Bracket */}
          <p
            className="text-xs font-bold uppercase tracking-widest mb-2"
            style={{ color: 'var(--color-accent)' }}
          >
            {t('winners_bracket')}
          </p>
          <BracketGrid rounds={bd.winnersBracket} />

          {/* Losers Bracket */}
          {bd.losersBracket.length > 0 && (
            <>
              <p
                className="text-xs font-bold uppercase tracking-widest mt-6 mb-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('losers_bracket')}
              </p>
              <BracketGrid rounds={bd.losersBracket} isLosers />
            </>
          )}

          {/* Grand Final */}
          <p
            className="text-xs font-bold uppercase tracking-widest mt-6 mb-2"
            style={{ color: '#fbbf24' }}
          >
            {t('grand_final')}
          </p>
          <div className="flex gap-4">
            <MatchCard match={bd.grandFinal as BracketMatch} isFinal />
            {bd.superFinal.needed !== false && (
              <MatchCard match={bd.superFinal as BracketMatch} isFinal label={t('super_final')} />
            )}
          </div>

          {/* Champion */}
          {bd.champion && (
            <div className="mt-6 text-center">
              <span className="text-2xl">🏆</span>
              <p className="text-lg font-black text-white mt-1">
                {bd.players.find((p) => p.id === bd.champion)
                  ? `${bd.players.find((p) => p.id === bd.champion)!.firstName} ${bd.players.find((p) => p.id === bd.champion)!.lastName}`
                  : bd.champion}
              </p>
              <p className="text-sm" style={{ color: 'var(--color-accent)' }}>
                {t('champion')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function BracketGrid({
  rounds,
  isLosers = false,
}: {
  rounds: BracketMatch[][];
  isLosers?: boolean;
}) {
  return (
    <div className="flex gap-4 items-start">
      {rounds.map((round, ri) => (
        <div key={ri} className="flex flex-col gap-3">
          <p className="text-xs text-center mb-1" style={{ color: 'var(--color-text-secondary)' }}>
            {isLosers ? `LB R${ri + 1}` : `R${ri + 1}`}
          </p>
          {round.map((match) => (
            <MatchCard key={match.id} match={match} />
          ))}
        </div>
      ))}
    </div>
  );
}

function MatchCard({
  match,
  isFinal = false,
  label,
}: {
  match: BracketMatch;
  isFinal?: boolean;
  label?: string;
}) {
  const p1 = match.player1;
  const p2 = match.player2;
  const isTBD = (p: typeof p1) => p.id === 'tbd' || p.id === 'bye';

  return (
    <div
      className="w-44 rounded-xl border overflow-hidden"
      style={{
        borderColor: isFinal ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.1)',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      {label && (
        <div
          className="px-2 py-0.5 text-xs font-bold text-center"
          style={{ backgroundColor: 'rgba(251,191,36,0.1)', color: '#fbbf24' }}
        >
          {label}
        </div>
      )}
      <PlayerRow
        player={p1}
        isWinner={match.winner === p1.id}
        isLoser={match.loser === p1.id}
        isTBD={isTBD(p1)}
      />
      <div className="h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
      <PlayerRow
        player={p2}
        isWinner={match.winner === p2.id}
        isLoser={match.loser === p2.id}
        isTBD={isTBD(p2)}
      />
    </div>
  );
}

function PlayerRow({
  player,
  isWinner,
  isLoser,
  isTBD,
}: {
  player: BracketMatch['player1'];
  isWinner: boolean;
  isLoser: boolean;
  isTBD: boolean;
}) {
  const name = isTBD
    ? player.id === 'bye'
      ? 'BYE'
      : 'TBD'
    : `${player.firstName} ${player.lastName}`;

  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2"
      style={{
        backgroundColor: isWinner ? 'rgba(34,197,94,0.08)' : 'transparent',
        opacity: isLoser ? 0.45 : 1,
      }}
    >
      <span
        className="text-xs w-4 text-right shrink-0 font-mono"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {isTBD ? '' : player.number}
      </span>
      <span
        className="flex-1 text-xs truncate"
        style={{
          color: isWinner ? '#86efac' : isTBD ? 'rgba(255,255,255,0.25)' : 'white',
          fontWeight: isWinner ? 700 : 400,
        }}
      >
        {name}
      </span>
      {isWinner && <span className="text-xs text-green-400 shrink-0">✓</span>}
    </div>
  );
}
