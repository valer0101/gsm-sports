'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useOperatorBrackets, useRecordResult } from '@/hooks/useOperator';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Bracket, BracketMatch } from '@/types/api';

export default function OperatorTournamentPage({
  params,
}: {
  params: Promise<{ tournamentId: string }>;
}) {
  const { tournamentId } = use(params);
  const t = useTranslations('operator_tournament');
  const { data: brackets, isLoading } = useOperatorBrackets(tournamentId);
  const [selectedBracketIdx, setSelectedBracketIdx] = useState(0);

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!brackets?.length) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10 text-center">
        <p className="text-white mb-2 font-semibold">{t('no_bracket')}</p>
        <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
          {t('no_bracket_desc')}
        </p>
        <Link
          href="/operator"
          className="underline text-sm"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {t('back')}
        </Link>
      </div>
    );
  }

  const bracket = brackets[selectedBracketIdx];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/operator"
        className="inline-flex items-center gap-2 text-sm mb-6 hover:text-white transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t('my_tournaments')}
      </Link>

      <h1 className="text-xl font-black text-white mb-4">{t('title')}</h1>

      {/* Category tabs */}
      {brackets.length > 1 && (
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
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
              {b.weightCategory?.name ?? t('category', { n: idx + 1 })}
            </button>
          ))}
        </div>
      )}

      <MatchList bracket={bracket} />
    </div>
  );
}

function MatchList({ bracket }: { bracket: Bracket }) {
  const t = useTranslations('operator_tournament');
  const record = useRecordResult(bracket.id);
  const [confirm, setConfirm] = useState<{
    matchId: string;
    winnerId: string;
    winnerName: string;
  } | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const bd = bracket.bracketData;

  const pendingMatches: (BracketMatch & { sectionLabel: string })[] = [];

  const isTBD = (id: string) => id === 'tbd' || id === 'bye';
  const isPlayable = (m: BracketMatch) =>
    !m.winner &&
    !isTBD(m.player1.id) &&
    !isTBD(m.player2.id) &&
    m.player1.id !== 'bye' &&
    m.player2.id !== 'bye';

  bd.winnersBracket.forEach((round, ri) => {
    round.forEach((m) => {
      if (isPlayable(m)) pendingMatches.push({ ...m, sectionLabel: t('wb_round', { n: ri + 1 }) });
    });
  });

  bd.losersBracket.forEach((round, ri) => {
    round.forEach((m) => {
      if (isPlayable(m)) pendingMatches.push({ ...m, sectionLabel: t('lb_round', { n: ri + 1 }) });
    });
  });

  if (isPlayable(bd.grandFinal as BracketMatch)) {
    pendingMatches.push({ ...(bd.grandFinal as BracketMatch), sectionLabel: t('grand_final') });
  }

  if (bd.superFinal.needed !== false && isPlayable(bd.superFinal as BracketMatch)) {
    pendingMatches.push({ ...(bd.superFinal as BracketMatch), sectionLabel: t('super_final') });
  }

  function playerName(p: BracketMatch['player1']) {
    return `${p.firstName} ${p.lastName}`;
  }

  function doRecord() {
    if (!confirm) return;
    record.mutate(
      { matchId: confirm.matchId, winnerId: confirm.winnerId },
      {
        onSuccess: () => {
          setLastResult(t('winner_result', { name: confirm.winnerName }));
          setConfirm(null);
          setTimeout(() => setLastResult(null), 3000);
        },
      },
    );
  }

  if (bd.champion) {
    const champ = bd.players.find((p) => p.id === bd.champion);
    return (
      <div
        className="rounded-2xl border border-yellow-500/30 p-8 text-center"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <span className="text-4xl">🏆</span>
        <p className="text-xl font-black text-white mt-3">
          {champ ? `${champ.firstName} ${champ.lastName}` : bd.champion}
        </p>
        <p className="text-sm mt-1" style={{ color: '#fbbf24' }}>
          {t('champion_label')}
        </p>
      </div>
    );
  }

  if (pendingMatches.length === 0) {
    return (
      <p className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
        {t('no_matches')}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {lastResult && (
        <div className="rounded-xl px-4 py-3 text-sm text-green-300 bg-green-500/10 border border-green-500/20">
          ✓ {lastResult}
        </div>
      )}

      {pendingMatches.map((match) => (
        <div
          key={match.id}
          className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <div
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider border-b border-white/5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {match.sectionLabel}
          </div>

          <div className="p-4 grid grid-cols-2 gap-3">
            {/* Player 1 */}
            <button
              disabled={record.isPending && confirm?.matchId === match.id}
              onClick={() =>
                setConfirm({
                  matchId: match.id,
                  winnerId: match.player1.id,
                  winnerName: playerName(match.player1),
                })
              }
              className="py-4 px-3 rounded-xl border text-center transition-colors hover:border-[var(--color-accent)] group"
              style={{
                borderColor:
                  confirm?.matchId === match.id && confirm.winnerId === match.player1.id
                    ? 'var(--color-accent)'
                    : 'rgba(255,255,255,0.1)',
              }}
            >
              <p className="font-bold text-white text-lg leading-tight">
                {match.player1.firstName}
              </p>
              <p className="font-bold text-white text-lg leading-tight">{match.player1.lastName}</p>
              <p className="text-xs mt-2 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {t('winner_btn')}
              </p>
            </button>

            {/* Player 2 */}
            <button
              disabled={record.isPending && confirm?.matchId === match.id}
              onClick={() =>
                setConfirm({
                  matchId: match.id,
                  winnerId: match.player2.id,
                  winnerName: playerName(match.player2),
                })
              }
              className="py-4 px-3 rounded-xl border text-center transition-colors hover:border-[var(--color-accent)] group"
              style={{
                borderColor:
                  confirm?.matchId === match.id && confirm.winnerId === match.player2.id
                    ? 'var(--color-accent)'
                    : 'rgba(255,255,255,0.1)',
              }}
            >
              <p className="font-bold text-white text-lg leading-tight">
                {match.player2.firstName}
              </p>
              <p className="font-bold text-white text-lg leading-tight">{match.player2.lastName}</p>
              <p className="text-xs mt-2 text-green-400 opacity-0 group-hover:opacity-100 transition-opacity">
                {t('winner_btn')}
              </p>
            </button>
          </div>

          {/* Confirm row */}
          {confirm?.matchId === match.id && (
            <div className="px-4 pb-4">
              <div className="rounded-xl p-3 bg-white/5 border border-white/10 flex items-center justify-between gap-3">
                <p className="text-sm text-white">
                  {t('winner_label')}{' '}
                  <span className="font-bold" style={{ color: 'var(--color-accent)' }}>
                    {confirm.winnerName}
                  </span>
                </p>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={doRecord}
                    disabled={record.isPending}
                    className="px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50"
                    style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                  >
                    {record.isPending ? '...' : t('confirm')}
                  </button>
                  <button
                    onClick={() => setConfirm(null)}
                    className="px-3 py-1.5 rounded-lg text-sm border border-white/10 hover:bg-white/10 transition-colors"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
              {record.error && (
                <p className="mt-2 text-xs text-red-400">
                  {(record.error as any)?.response?.data?.message ?? t('error')}
                </p>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
