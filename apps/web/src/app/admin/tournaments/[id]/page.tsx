'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  useAdminTournament,
  useToggleRegistration,
  useGenerateBrackets,
  useAdminOperators,
  useAssignOperator,
  useRemoveOperator,
  useAdminBrackets,
  useAdminResetMatch,
  useAdminLockBracket,
  useAdminBracketAuditLog,
  useAdminCorrectResult,
} from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Bracket, BracketMatch, BracketAuditLog } from '@/types/api';

export default function AdminTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('admin_tournament');
  const tAdmin = useTranslations('admin');
  const { data: tournament, isLoading } = useAdminTournament(id);
  const toggleReg = useToggleRegistration(id);
  const generateBrackets = useGenerateBrackets(id);
  const { data: operators } = useAdminOperators(id);
  const { data: brackets } = useAdminBrackets(id);
  const assignOp = useAssignOperator(id);
  const removeOp = useRemoveOperator(id);

  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [operatorEmail, setOperatorEmail] = useState('');
  const [assignError, setAssignError] = useState('');
  const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 text-center text-white">
        {t('not_found')}{' '}
        <Link href="/admin" className="underline">
          {t('back')}
        </Link>
      </div>
    );
  }

  const canToggleReg = !tournament.bracketGenerated;

  async function handleAssignOperator(e: React.FormEvent) {
    e.preventDefault();
    setAssignError('');
    assignOp.mutate(operatorEmail, {
      onSuccess: () => setOperatorEmail(''),
      onError: (err: any) => setAssignError(err?.response?.data?.message ?? t('assign_error')),
    });
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">
      <Link
        href="/admin"
        className="inline-flex items-center gap-2 text-sm hover:text-white transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t('back')}
      </Link>

      {/* Header */}
      <div
        className="rounded-2xl border border-white/10 p-6"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-black text-white">{tournament.name}</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
              {[tournament.city, tournament.country].filter(Boolean).join(', ')} ·{' '}
              {new Date(tournament.startDate).toLocaleDateString('ru-RU')}
            </p>
          </div>
          <StatusBadge status={tournament.status} tAdmin={tAdmin} />
        </div>

        {/* Stats */}
        <dl className="grid grid-cols-3 gap-4 mt-5">
          <Stat label={t('stat_format')} value={t('stat_format_value')} />
          <Stat
            label={t('stat_registration')}
            value={
              tournament.registrationOpen
                ? t('stat_registration_open')
                : t('stat_registration_closed')
            }
          />
          <Stat
            label={t('stat_bracket')}
            value={
              tournament.bracketGenerated ? t('stat_bracket_ready') : t('stat_bracket_pending')
            }
          />
        </dl>
      </div>

      {/* Registration control */}
      <Section title={t('manage_registration')}>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            disabled={!canToggleReg || toggleReg.isPending}
            onClick={() => toggleReg.mutate()}
            className="px-4 py-2.5 rounded-xl text-sm font-bold transition-colors disabled:opacity-40"
            style={{
              backgroundColor: tournament.registrationOpen
                ? 'rgba(239,68,68,0.15)'
                : 'rgba(34,197,94,0.15)',
              color: tournament.registrationOpen ? '#f87171' : '#86efac',
              border: `1px solid ${tournament.registrationOpen ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
            }}
          >
            {toggleReg.isPending
              ? t('updating')
              : tournament.registrationOpen
                ? t('close_registration')
                : t('open_registration')}
          </button>

          {!tournament.registrationOpen && !tournament.bracketGenerated && (
            <button
              onClick={() => setShowGenerateConfirm(true)}
              className="px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
              style={{
                backgroundColor: 'rgba(168,85,247,0.15)',
                color: '#c084fc',
                border: '1px solid rgba(168,85,247,0.3)',
              }}
            >
              {t('generate_btn')}
            </button>
          )}

          {tournament.bracketGenerated && (
            <span className="text-sm text-green-400">{t('bracket_generated_badge')}</span>
          )}
        </div>

        {/* Generate confirm dialog */}
        {showGenerateConfirm && (
          <div className="mt-4 p-4 rounded-xl border border-white/10 bg-white/5">
            <p className="text-white font-semibold mb-1">{t('generate_confirm_title')}</p>
            <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
              {t('generate_confirm_desc')}
            </p>
            <div className="flex gap-2">
              <button
                disabled={generateBrackets.isPending}
                onClick={() =>
                  generateBrackets.mutate(undefined, {
                    onSuccess: () => setShowGenerateConfirm(false),
                  })
                }
                className="px-4 py-2 rounded-xl text-sm font-bold"
                style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
              >
                {generateBrackets.isPending ? t('generating') : t('confirm')}
              </button>
              <button
                onClick={() => setShowGenerateConfirm(false)}
                className="px-4 py-2 rounded-xl text-sm border border-white/10 hover:bg-white/5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('cancel')}
              </button>
            </div>
            {generateBrackets.isSuccess && (
              <p className="mt-2 text-green-400 text-sm">
                {t('generated_count', {
                  count: (generateBrackets.data as any)?.bracketsCreated ?? 0,
                })}
              </p>
            )}
            {generateBrackets.error && (
              <p className="mt-2 text-red-400 text-sm">
                {(generateBrackets.error as any)?.response?.data?.message ?? t('error')}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Operators */}
      <Section title={t('operators_title')}>
        {operators && operators.length > 0 ? (
          <div className="divide-y divide-white/5 mb-4">
            {operators.map((op) => (
              <div key={op.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-white font-medium">
                    {op.user ? `${op.user.firstName} ${op.user.lastName}` : op.operatorId}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                    {op.user?.email}
                  </p>
                </div>
                <button
                  onClick={() => removeOp.mutate(op.operatorId)}
                  className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  {t('remove_operator')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
            {t('no_operators')}
          </p>
        )}

        {/* Assign form */}
        <form onSubmit={handleAssignOperator} className="flex gap-2">
          <input
            type="email"
            value={operatorEmail}
            onChange={(e) => {
              setOperatorEmail(e.target.value);
              setAssignError('');
            }}
            placeholder={t('operator_email_placeholder')}
            required
            className="flex-1 px-4 py-2.5 rounded-xl bg-transparent border border-white/15 text-white text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
          />
          <button
            type="submit"
            disabled={assignOp.isPending}
            className="px-4 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50 transition-opacity"
            style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
          >
            {assignOp.isPending ? '...' : t('assign_btn')}
          </button>
        </form>
        {assignError && <p className="mt-2 text-xs text-red-400">{assignError}</p>}
      </Section>

      {/* Bracket management — visible after bracket is generated */}
      {tournament.bracketGenerated && brackets && brackets.length > 0 && (
        <Section title={t('bracket_management_title')}>
          {/* Bracket selector */}
          {brackets.length > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {brackets.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setSelectedBracketId(selectedBracketId === b.id ? null : b.id)}
                  className="shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors"
                  style={{
                    borderColor:
                      selectedBracketId === b.id ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                    color:
                      selectedBracketId === b.id
                        ? 'var(--color-accent)'
                        : 'var(--color-text-secondary)',
                  }}
                >
                  {b.name ?? b.weightCategory?.name ?? `Bracket`}
                  {b.isLocked && ' 🔒'}
                </button>
              ))}
            </div>
          )}

          {/* Single bracket — auto-select */}
          {brackets.length === 1 && !selectedBracketId && (
            <button
              onClick={() => setSelectedBracketId(brackets[0].id)}
              className="mb-4 px-4 py-2 rounded-xl text-sm border border-white/10 hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('open_bracket_manager')} →
            </button>
          )}

          {selectedBracketId && (
            <BracketManager
              bracketId={selectedBracketId}
              tournamentId={id}
              bracket={brackets.find((b) => b.id === selectedBracketId)!}
              t={t}
            />
          )}
        </Section>
      )}

      {/* View public page link */}
      <div className="text-center">
        <Link
          href={`/tournaments/${tournament.slug}`}
          target="_blank"
          className="text-sm underline hover:text-white transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {t('view_public')}
        </Link>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-white/10 p-6"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <h2 className="font-bold text-white mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt
        className="text-xs uppercase tracking-wider mb-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </dt>
      <dd className="text-sm font-semibold text-white">{value}</dd>
    </div>
  );
}

// ─── Bracket Manager Component ─────────────────────────────

function BracketManager({
  bracketId,
  tournamentId,
  bracket,
  t,
}: {
  bracketId: string;
  tournamentId: string;
  bracket: Bracket;
  t: ReturnType<typeof useTranslations>;
}) {
  const lockMutation = useAdminLockBracket(bracketId, tournamentId);
  const resetMatch = useAdminResetMatch(bracketId, tournamentId);
  const correctResult = useAdminCorrectResult(bracketId, tournamentId);
  const { data: auditLog } = useAdminBracketAuditLog(bracketId);

  const [showAudit, setShowAudit] = useState(false);
  const [resetState, setResetState] = useState<{
    matchId: string;
    label: string;
  } | null>(null);
  const [correctState, setCorrectState] = useState<{
    matchId: string;
    label: string;
    player1Id: string;
    player1Name: string;
    player2Id: string;
    player2Name: string;
  } | null>(null);
  const [resetReason, setResetReason] = useState('');
  const [correctWinnerId, setCorrectWinnerId] = useState('');
  const [correctReason, setCorrectReason] = useState('');

  const bd = bracket.bracketData;

  if (!bd) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {t('no_bracket')}
      </p>
    );
  }

  type MatchRow = {
    match: BracketMatch;
    label: string;
  };

  const allMatches: MatchRow[] = [];

  bd.winnersBracket.forEach((round, ri) => {
    round.forEach((m) => {
      allMatches.push({ match: m, label: t('wb_round', { n: ri + 1 }) });
    });
  });

  bd.losersBracket.forEach((round, ri) => {
    round.forEach((m) => {
      allMatches.push({ match: m, label: t('lb_round', { n: ri + 1 }) });
    });
  });

  allMatches.push({ match: bd.grandFinal as BracketMatch, label: t('grand_final') });
  if (bd.superFinal.needed) {
    allMatches.push({ match: bd.superFinal as BracketMatch, label: t('super_final') });
  }

  const playedMatches = allMatches.filter(
    (r) =>
      r.match.winner &&
      r.match.winner !== 'bye' &&
      r.match.player1.id !== 'tbd' &&
      r.match.player2.id !== 'tbd',
  );

  function pName(p: { firstName: string; lastName: string }) {
    return `${p.firstName} ${p.lastName}`.trim();
  }

  function getPlayerName(id: string) {
    const p = bd!.players.find((pl) => pl.id === id);
    if (p) return pName(p);
    for (const row of allMatches) {
      if (row.match.player1.id === id) return pName(row.match.player1);
      if (row.match.player2.id === id) return pName(row.match.player2);
    }
    return id;
  }

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('modifications_count', { n: bracket.modificationCount ?? 0 })}
        </span>
        {bracket.lastModifiedAt && (
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            · {new Date(bracket.lastModifiedAt).toLocaleString('ru-RU')}
          </span>
        )}

        {/* Lock / Unlock */}
        <button
          onClick={() => lockMutation.mutate(!bracket.isLocked)}
          disabled={lockMutation.isPending}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50"
          style={{
            borderColor: bracket.isLocked ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.1)',
            color: bracket.isLocked ? '#fbbf24' : 'var(--color-text-secondary)',
          }}
        >
          {bracket.isLocked ? t('unlock_bracket') : t('lock_bracket')}
        </button>

        {/* Audit log */}
        <button
          onClick={() => setShowAudit((v) => !v)}
          className="px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:bg-white/5 transition-colors"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {showAudit ? t('audit_hide') : t('audit_show')}
        </button>
      </div>

      {/* Audit log */}
      {showAudit && auditLog && <AuditLogTable logs={auditLog} getPlayerName={getPlayerName} />}

      {/* Played matches — can reset or correct */}
      {playedMatches.length > 0 && (
        <div>
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('played_matches')}
          </p>
          <div className="space-y-2">
            {playedMatches.map(({ match, label }) => {
              const winnerName = match.winner ? getPlayerName(match.winner) : '—';
              const isResetting = resetState?.matchId === match.id;
              const isCorrecting = correctState?.matchId === match.id;

              return (
                <div
                  key={match.id}
                  className="rounded-xl border border-white/8 p-3"
                  style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span
                        className="text-xs mr-2"
                        style={{ color: 'var(--color-text-secondary)' }}
                      >
                        {label}
                      </span>
                      <span className="text-sm text-white">
                        {pName(match.player1)} vs {pName(match.player2)}
                      </span>
                      <span className="text-xs ml-2 text-green-400">→ {winnerName}</span>
                      {match.correctedAt && (
                        <span className="text-xs ml-2 text-yellow-400">{t('corrected_badge')}</span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setCorrectState({
                            matchId: match.id,
                            label,
                            player1Id: match.player1.id,
                            player1Name: pName(match.player1),
                            player2Id: match.player2.id,
                            player2Name: pName(match.player2),
                          });
                          setCorrectWinnerId('');
                          setCorrectReason('');
                          setResetState(null);
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                        style={{ color: '#c084fc' }}
                      >
                        {t('correct_result')}
                      </button>
                      <button
                        onClick={() => {
                          setResetState({ matchId: match.id, label });
                          setResetReason('');
                          setCorrectState(null);
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                        style={{ color: '#f87171' }}
                      >
                        {t('reset_match')}
                      </button>
                    </div>
                  </div>

                  {/* Reset form */}
                  {isResetting && (
                    <div className="mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                      <p className="text-xs text-red-300 mb-2">
                        {t.rich('reset_confirm', {
                          label,
                          strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                      </p>
                      <input
                        value={resetReason}
                        onChange={(e) => setResetReason(e.target.value)}
                        placeholder={t('reset_reason_placeholder')}
                        className="w-full mb-2 px-3 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={resetMatch.isPending}
                          onClick={() =>
                            resetMatch.mutate(
                              { matchId: match.id, reason: resetReason || undefined },
                              { onSuccess: () => setResetState(null) },
                            )
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-300 disabled:opacity-50"
                        >
                          {resetMatch.isPending ? '...' : t('reset_confirm_btn')}
                        </button>
                        <button
                          onClick={() => setResetState(null)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:bg-white/5"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Correct form */}
                  {isCorrecting && correctState && (
                    <div className="mt-3 p-3 rounded-xl bg-purple-500/5 border border-purple-500/20">
                      <p className="text-xs text-purple-300 mb-2">
                        {t.rich('correct_title', {
                          label,
                          strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                      </p>
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => setCorrectWinnerId(correctState.player1Id)}
                          className="flex-1 py-2 rounded-lg text-xs border transition-colors"
                          style={{
                            borderColor:
                              correctWinnerId === correctState.player1Id
                                ? 'var(--color-accent)'
                                : 'rgba(255,255,255,0.1)',
                            color:
                              correctWinnerId === correctState.player1Id
                                ? 'var(--color-accent)'
                                : 'var(--color-text-secondary)',
                          }}
                        >
                          {correctState.player1Name}
                        </button>
                        <button
                          onClick={() => setCorrectWinnerId(correctState.player2Id)}
                          className="flex-1 py-2 rounded-lg text-xs border transition-colors"
                          style={{
                            borderColor:
                              correctWinnerId === correctState.player2Id
                                ? 'var(--color-accent)'
                                : 'rgba(255,255,255,0.1)',
                            color:
                              correctWinnerId === correctState.player2Id
                                ? 'var(--color-accent)'
                                : 'var(--color-text-secondary)',
                          }}
                        >
                          {correctState.player2Name}
                        </button>
                      </div>
                      <input
                        value={correctReason}
                        onChange={(e) => setCorrectReason(e.target.value)}
                        placeholder={t('correct_reason_placeholder')}
                        className="w-full mb-2 px-3 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={!correctWinnerId || correctResult.isPending}
                          onClick={() =>
                            correctResult.mutate(
                              {
                                matchId: match.id,
                                winnerId: correctWinnerId,
                                reason: correctReason || undefined,
                              },
                              { onSuccess: () => setCorrectState(null) },
                            )
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40"
                          style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
                        >
                          {correctResult.isPending ? '...' : t('save')}
                        </button>
                        <button
                          onClick={() => setCorrectState(null)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:bg-white/5"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {t('cancel')}
                        </button>
                      </div>
                      {correctResult.error && (
                        <p className="mt-2 text-xs text-red-400">
                          {(correctResult.error as any)?.response?.data?.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {playedMatches.length === 0 && (
        <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('no_played_matches')}
        </p>
      )}
    </div>
  );
}

function AuditLogTable({
  logs,
  getPlayerName: _getPlayerName,
}: {
  logs: BracketAuditLog[];
  getPlayerName: (id: string) => string;
}) {
  const t = useTranslations('admin_tournament');
  const actionLabel: Record<string, string> = {
    result_recorded: t('action_result_recorded'),
    result_corrected: t('action_result_corrected'),
    match_reset: t('action_match_reset'),
    bracket_reset: t('action_bracket_reset'),
    bracket_locked: t('action_bracket_locked'),
    bracket_unlocked: t('action_bracket_unlocked'),
  };

  return (
    <div className="rounded-xl border border-white/8 overflow-hidden">
      <div
        className="px-4 py-2 text-xs font-bold uppercase tracking-wider border-b border-white/5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t('audit_title')}
      </div>
      <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
        {logs.length === 0 && (
          <p className="px-4 py-3 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
            {t('audit_empty')}
          </p>
        )}
        {logs.map((log) => (
          <div key={log.id} className="px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-white font-medium">
                {actionLabel[log.action] ?? log.action}
                {log.matchId && <span className="ml-1 text-gray-400">· {log.matchId}</span>}
              </p>
              {log.reason && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                  {log.reason}
                </p>
              )}
            </div>
            <p className="text-xs shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
              {new Date(log.createdAt).toLocaleString('ru-RU')}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function StatusBadge({
  status,
  tAdmin,
}: {
  status: string;
  tAdmin: ReturnType<typeof useTranslations>;
}) {
  const colorMap: Record<string, string> = {
    draft: '#6b7280',
    upcoming: '#3b82f6',
    registration_open: '#22c55e',
    registration_closed: '#f59e0b',
    bracket_ready: '#a855f7',
    active: '#ef4444',
    completed: '#6b7280',
  };
  const color = colorMap[status] ?? '#6b7280';
  const label = tAdmin(`status_${status}` as any, { defaultValue: status });
  return (
    <span
      className="text-xs px-3 py-1 rounded-full font-medium shrink-0"
      style={{ backgroundColor: color + '20', color }}
    >
      {label}
    </span>
  );
}
