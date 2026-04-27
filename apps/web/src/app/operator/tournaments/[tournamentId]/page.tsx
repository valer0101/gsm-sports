'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  useOperatorBrackets,
  useRecordResult,
  useOperatorWithdrawPlayer,
  useOperatorMyTable,
  useOperatorClaimNext,
} from '@/hooks/useOperator';
import { useTournamentSchedule } from '@/hooks/useSchedule';
import { Skeleton } from '@/components/ui/Skeleton';
import { Avatar } from '@/components/Avatar';
import { MatchResultForm } from '@/components/tournaments/MatchResultForm';
import type {
  Bracket,
  BracketMatch,
  MatchResult,
  MatchResultSchema,
} from '@/types/api';

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
        ← {t('my_tournaments')}
      </Link>

      <h1 className="text-xl font-black text-white mb-4">{t('title')}</h1>

      <MyTableBanner tournamentId={tournamentId} />

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
              {b.weightCategory?.name ?? b.name ?? t('category', { n: idx + 1 })}
              {b.isLocked && <span className="ml-1 text-yellow-400">🔒</span>}
            </button>
          ))}
        </div>
      )}

      {bracket.isLocked && (
        <div className="mb-4 rounded-xl px-4 py-3 text-sm text-yellow-300 bg-yellow-500/10 border border-yellow-500/20">
          🔒 {t('bracket_locked')}
        </div>
      )}

      {bracket.bracketData ? (
        <MatchList bracket={bracket} tournamentId={tournamentId} />
      ) : (
        <p className="text-center py-8" style={{ color: 'var(--color-text-secondary)' }}>
          {t('no_bracket')}
        </p>
      )}
    </div>
  );
}

function MyTableBanner({ tournamentId }: { tournamentId: string }) {
  const t = useTranslations('operator_tournament');
  const { data: myTable, isLoading } = useOperatorMyTable(tournamentId);
  const claim = useOperatorClaimNext(tournamentId, myTable?.table?.id ?? '');

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-xl mb-5" />;
  }

  // Operator is roaming (not pinned) — skip the banner entirely. Claim flow
  // for roaming operators is out of scope for this PR (they'd need to pick a
  // table first). They still see the full pending-match list below.
  if (!myTable) return null;

  const { table, activeAssignment } = myTable;
  const busy = table.status === 'busy' && activeAssignment;

  return (
    <div
      className="mb-5 rounded-2xl border p-4"
      style={{
        backgroundColor: 'var(--color-secondary)',
        borderColor: busy ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-secondary)' }}>
            {t('your_table_label')}
          </p>
          <p className="font-black text-white text-lg">
            {t('table_number', { n: table.number })}
            {table.name ? ` · ${table.name}` : ''}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
            {t(`table_status_${table.status}`)}
          </p>
        </div>

        {!busy && (
          <button
            disabled={claim.isPending || table.status === 'offline'}
            onClick={() => claim.mutate()}
            className="shrink-0 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
          >
            {claim.isPending ? '...' : t('claim_next_btn')}
          </button>
        )}
      </div>

      {claim.error && (
        <p className="mt-2 text-xs text-red-400">
          {(claim.error as any)?.response?.data?.message ?? t('error')}
        </p>
      )}

      {busy && activeAssignment && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {t('running_now')}
          </p>
          <p className="text-sm text-white font-semibold mt-0.5">
            {t('match_id_label', { id: activeAssignment.matchId })}
          </p>
        </div>
      )}
    </div>
  );
}

function MatchList({ bracket, tournamentId }: { bracket: Bracket; tournamentId: string }) {
  const { data: myTable } = useOperatorMyTable(tournamentId);
  const { data: schedule } = useTournamentSchedule(tournamentId);
  const myTableId = myTable?.table?.id ?? null;
  const activeAssignmentMatchId = myTable?.activeAssignment?.matchId ?? null;

  // matchId → scheduled entry (ETA + queue position) for quick lookup.
  const scheduledByMatchId = new Map(
    (schedule?.scheduled ?? []).map((s) => [s.matchId, s]),
  );
  const t = useTranslations('operator_tournament');
  const record = useRecordResult(bracket.id);
  const withdraw = useOperatorWithdrawPlayer(bracket.id, bracket.tournamentId);
  const [confirm, setConfirm] = useState<{
    matchId: string;
    winnerId: string;
    winnerName: string;
  } | null>(null);
  const [withdrawState, setWithdrawState] = useState<{
    matchId: string;
    position: 1 | 2;
    playerName: string;
    opponentName: string;
  } | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');
  const [lastResult, setLastResult] = useState<string | null>(null);
  // Schema-driven result detail captured by <MatchResultForm>. Reset on
  // confirm / cancel so stale armwrestling data doesn't leak into the
  // next match's payload.
  const [resultDetail, setResultDetail] = useState<MatchResult | null | undefined>(
    undefined,
  );

  // Sport's `matchResultSchema` — missing on endpoints that don't load
  // the tournament relation, in which case the form falls back to
  // `simple_winner` (just the winner click, no extra fields).
  //
  // Resolution order matches the API validator (`recordResult` in
  // BracketsService): per-tournament `sportConfig.matchResultSchema`
  // override > sport-wide `sport.config.matchResultSchema` >
  // `simple_winner`. Without the override mirror, an organizer who
  // sets a per-event schema would see the wrong form here and the
  // backend would reject the payload with `INVALID_MATCH_RESULT`.
  const resultSchema: MatchResultSchema =
    bracket.tournament?.sportConfig?.matchResultSchema ??
    bracket.tournament?.sport?.config?.matchResultSchema ??
    'simple_winner';

  const bd = bracket.bracketData!;

  const isTBD = (id: string) => id === 'tbd' || id === 'bye';
  const isPlayable = (m: BracketMatch) => !m.winner && !isTBD(m.player1.id) && !isTBD(m.player2.id);

  type MatchWithLabel = BracketMatch & { sectionLabel: string };
  const pendingMatches: MatchWithLabel[] = [];

  // Round labels differ by format: round-robin uses neutral "Round N";
  // elimination keeps "WB R{n}" / "LB R{n}" semantics.
  const isRR = bd.format === 'round_robin';

  bd.winnersBracket.forEach((round, ri) => {
    round.forEach((m) => {
      if (!isPlayable(m)) return;
      const label = isRR
        ? t('rr_round', { n: ri + 1 })
        : t('wb_round', { n: ri + 1 });
      pendingMatches.push({ ...m, sectionLabel: label });
    });
  });

  bd.losersBracket.forEach((round, ri) => {
    round.forEach((m) => {
      if (isPlayable(m)) pendingMatches.push({ ...m, sectionLabel: t('lb_round', { n: ri + 1 }) });
    });
  });

  // Grand / super final aren't reachable for round-robin or single-elim,
  // but the existing isPlayable() check already short-circuits TBD-vs-TBD
  // match cards. Skip them entirely for non-double-elim to keep the
  // operator's pending list focused.
  if (bd.format !== 'round_robin' && bd.format !== 'single_elim') {
    if (isPlayable(bd.grandFinal as BracketMatch)) {
      pendingMatches.push({ ...(bd.grandFinal as BracketMatch), sectionLabel: t('grand_final') });
    }

    if (bd.superFinal.needed && isPlayable(bd.superFinal as BracketMatch)) {
      pendingMatches.push({ ...(bd.superFinal as BracketMatch), sectionLabel: t('super_final') });
    }
  }

  function playerName(p: BracketMatch['player1']) {
    return `${p.firstName} ${p.lastName}`.trim();
  }

  function doRecord() {
    if (!confirm) return;
    record.mutate(
      {
        matchId: confirm.matchId,
        winnerId: confirm.winnerId,
        // Three-way semantics: `undefined` = preserve prior blob (engine
        // contract), `null` = clear, object = record. Don't collapse
        // null→undefined here — the form may legitimately emit `null`
        // (e.g. an explicit "clear detail" button in a future iteration)
        // and the engine relies on the distinction. Cast through the
        // loose record shape the hook accepts (the discriminated union
        // doesn't have an index signature).
        result: resultDetail as Record<string, unknown> | null | undefined,
      },
      {
        onSuccess: () => {
          setLastResult(t('winner_result', { name: confirm.winnerName }));
          setConfirm(null);
          setResultDetail(undefined);
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

      {pendingMatches.map((match) => {
        const isConfirming = confirm?.matchId === match.id;
        const isRecording = record.isPending && isConfirming;
        const isRunningOnMyTable = myTableId !== null && activeAssignmentMatchId === match.id;
        const scheduled = scheduledByMatchId.get(match.id);

        return (
          <div
            key={match.id}
            className="rounded-2xl border overflow-hidden transition-colors"
            style={{
              backgroundColor: 'var(--color-secondary)',
              borderColor: isConfirming
                ? 'var(--color-accent)'
                : isRunningOnMyTable
                  ? 'var(--color-accent)'
                  : 'rgba(255,255,255,0.08)',
            }}
          >
            {/* Round label */}
            <div
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider border-b border-white/5 flex items-center justify-between gap-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <span>{match.sectionLabel}</span>
              <div className="flex items-center gap-2">
                {scheduled && !isRunningOnMyTable && (
                  <EtaBadge
                    estimatedStartAt={scheduled.estimatedStartAt}
                    order={scheduled.order}
                  />
                )}
                {isRunningOnMyTable && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-black"
                    style={{
                      color: 'var(--color-accent)',
                      backgroundColor: 'var(--color-accent-dim)',
                    }}
                  >
                    ▶ {t('running_on_my_table')}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 grid grid-cols-2 gap-3">
              {/* Player 1 */}
              <PlayerButton
                player={match.player1}
                disabled={isRecording || bracket.isLocked}
                selected={isConfirming && confirm?.winnerId === match.player1.id}
                onClick={() =>
                  setConfirm({
                    matchId: match.id,
                    winnerId: match.player1.id,
                    winnerName: playerName(match.player1),
                  })
                }
                winnerBtnLabel={t('winner_btn')}
              />

              {/* Player 2 */}
              <PlayerButton
                player={match.player2}
                disabled={isRecording || bracket.isLocked}
                selected={isConfirming && confirm?.winnerId === match.player2.id}
                onClick={() =>
                  setConfirm({
                    matchId: match.id,
                    winnerId: match.player2.id,
                    winnerName: playerName(match.player2),
                  })
                }
                winnerBtnLabel={t('winner_btn')}
              />
            </div>

            {/* Schema-driven result detail form — rendered between winner pick
                and Confirm so the operator fills victoryType / score / time
                before committing. `simple_winner` sports short-circuit to
                `null` inside the component. */}
            {isConfirming && (
              <MatchResultForm
                schema={resultSchema}
                match={match}
                onChange={setResultDetail}
              />
            )}

            {/* Confirm row */}
            {isConfirming && (
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
                      disabled={isRecording}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold disabled:opacity-50"
                      style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                    >
                      {isRecording ? '...' : t('confirm')}
                    </button>
                    <button
                      onClick={() => {
                        setConfirm(null);
                        setResultDetail(undefined);
                      }}
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

            {/* Withdraw row */}
            {!isConfirming && !bracket.isLocked && (
              <div className="px-4 pb-3 flex gap-2">
                <button
                  onClick={() => {
                    setWithdrawState({
                      matchId: match.id,
                      position: 1,
                      playerName: playerName(match.player1),
                      opponentName: playerName(match.player2),
                    });
                    setWithdrawReason('');
                  }}
                  className="text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                  style={{ color: '#f87171' }}
                >
                  {t('withdraw_btn', { name: match.player1.firstName })}
                </button>
                <button
                  onClick={() => {
                    setWithdrawState({
                      matchId: match.id,
                      position: 2,
                      playerName: playerName(match.player2),
                      opponentName: playerName(match.player1),
                    });
                    setWithdrawReason('');
                  }}
                  className="text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                  style={{ color: '#f87171' }}
                >
                  {t('withdraw_btn', { name: match.player2.firstName })}
                </button>
              </div>
            )}

            {/* Withdraw form */}
            {withdrawState?.matchId === match.id && (
              <div className="mx-4 mb-4 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                <p className="text-xs text-red-300 mb-2">
                  {t('withdraw_confirm', {
                    player: withdrawState.playerName,
                    opponent: withdrawState.opponentName,
                  })}
                </p>
                <input
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder={t('withdraw_reason_placeholder')}
                  className="w-full mb-2 px-3 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none"
                />
                <div className="flex gap-2">
                  <button
                    disabled={withdraw.isPending || withdrawReason.trim().length < 3}
                    onClick={() =>
                      withdraw.mutate(
                        {
                          matchId: withdrawState.matchId,
                          position: withdrawState.position,
                          reason: withdrawReason.trim(),
                        },
                        {
                          onSuccess: () => {
                            setLastResult(
                              t('withdraw_result', {
                                player: withdrawState.playerName,
                                opponent: withdrawState.opponentName,
                              }),
                            );
                            setWithdrawState(null);
                            setTimeout(() => setLastResult(null), 3000);
                          },
                        },
                      )
                    }
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-300 disabled:opacity-50"
                  >
                    {withdraw.isPending ? '...' : t('withdraw_confirm_btn')}
                  </button>
                  <button
                    onClick={() => setWithdrawState(null)}
                    className="px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:bg-white/5"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {t('cancel')}
                  </button>
                </div>
                {withdraw.error && (
                  <p className="mt-2 text-xs text-red-400">
                    {(withdraw.error as any)?.response?.data?.message ?? t('error')}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Small ETA pill on each pending match card. Shows a coarse "in N min"
 * label rather than an absolute clock time — the scheduler output drifts
 * on every recompute and minutes-from-now is the accurate mental model
 * for operators. Order is the global queue position across all tables.
 */
function EtaBadge({
  estimatedStartAt,
  order,
}: {
  estimatedStartAt: number;
  order: number;
}) {
  const t = useTranslations('operator_tournament');
  const nowMs = Date.now();
  const diffSec = Math.max(0, Math.round((estimatedStartAt - nowMs) / 1000));

  let label: string;
  if (diffSec < 60) label = t('eta_now');
  else if (diffSec < 3600) label = t('eta_minutes', { n: Math.round(diffSec / 60) });
  else label = t('eta_hours', { n: Math.round((diffSec / 3600) * 10) / 10 });

  return (
    <span
      className="px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1"
      style={{
        color: 'var(--color-text-secondary)',
        backgroundColor: 'rgba(255,255,255,0.05)',
      }}
    >
      <span>🕒 {label}</span>
      <span className="opacity-50">·</span>
      <span>#{order}</span>
    </span>
  );
}

function PlayerButton({
  player,
  disabled,
  selected,
  onClick,
  winnerBtnLabel,
}: {
  player: BracketMatch['player1'];
  disabled: boolean;
  selected: boolean;
  onClick: () => void;
  winnerBtnLabel: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className="py-4 px-3 rounded-xl border text-center transition-all hover:border-[var(--color-accent)] group disabled:opacity-50 disabled:cursor-not-allowed flex flex-col items-center"
      style={{
        borderColor: selected ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
        backgroundColor: selected ? 'var(--color-accent-dim)' : 'transparent',
      }}
    >
      <Avatar
        src={player.photoUrl}
        firstName={player.firstName}
        lastName={player.lastName}
        size={56}
        className="mb-2"
      />
      <p className="font-bold text-white text-lg leading-tight">{player.firstName}</p>
      <p className="font-bold text-white text-lg leading-tight">{player.lastName}</p>
      {player.seed && (
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          #{player.seed}
        </p>
      )}
      <p
        className="text-xs mt-2 text-green-400 transition-opacity"
        style={{ opacity: selected ? 1 : 0 }}
      >
        {winnerBtnLabel}
      </p>
    </button>
  );
}
