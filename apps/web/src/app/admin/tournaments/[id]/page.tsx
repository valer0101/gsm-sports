'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
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
  useAdminStartCategory,
  useAdminCheckInEntry,
  useAdminUndoCheckIn,
  useAdminBracketAuditLog,
  useAdminCorrectResult,
  useAdminReplacePlayer,
  useAdminWithdrawPlayer,
  useAdminReassignEntry,
  useConfirmedEntries,
} from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/Skeleton';
import type { Bracket, BracketMatch, BracketAuditLog, SportBracketFormat } from '@/types/api';

/**
 * Bracket-format generators wired through the API. Phase 3.3a shipped
 * single_elim + double_elim; phase 3.3b adds round_robin. Swiss and
 * groups_playoff are still in the union but not yet implemented;
 * filtering against this set keeps the dropdown honest (and avoids a
 * 400 on submit).
 */
const IMPLEMENTED_FORMATS: ReadonlySet<SportBracketFormat> = new Set([
  'single_elim',
  'double_elim',
  'round_robin',
]);

export default function AdminTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('admin_tournament');
  const tAdmin = useTranslations('admin');
  const locale = useLocale();
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
  const [generateFormat, setGenerateFormat] = useState<SportBracketFormat | ''>('');

  // Restrict the dropdown to formats that are BOTH allowed for the
  // sport AND have a generator landed today. The empty option means
  // "use the sport's default".
  const formatOptions: SportBracketFormat[] = (
    tournament?.sport?.config?.bracketFormats ?? []
  ).filter((f) => IMPLEMENTED_FORMATS.has(f));

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
              {new Date(tournament.startDate).toLocaleDateString(locale)}
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

            {/* Format selector — only shown when the sport allows multiple
                implemented formats. With one option (or zero), there's
                nothing to choose and the backend's default-fallback wins. */}
            {formatOptions.length > 1 && (
              <div className="mb-4">
                <label
                  className="block text-xs font-bold uppercase tracking-wider mb-1.5"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {t('format_label')}
                </label>
                <select
                  value={generateFormat}
                  onChange={(e) =>
                    setGenerateFormat(e.target.value as SportBracketFormat | '')
                  }
                  className="w-full px-3 py-2 rounded-xl bg-transparent border border-white/15 text-white text-sm outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="" className="bg-black">
                    {t('format_default', {
                      name: t(
                        `format_name_${tournament.sport?.config.defaultBracketFormat ?? 'double_elim'}`,
                      ),
                    })}
                  </option>
                  {formatOptions.map((f) => (
                    <option key={f} value={f} className="bg-black">
                      {t(`format_name_${f}`)}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <button
                disabled={generateBrackets.isPending}
                onClick={() =>
                  generateBrackets.mutate(
                    generateFormat ? { bracketFormat: generateFormat } : undefined,
                    {
                      onSuccess: () => setShowGenerateConfirm(false),
                    },
                  )
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

      {/* Registrations management — only available before bracket is generated */}
      {!tournament.bracketGenerated && (
        <Section
          title={t('registrations_title')}
          action={
            <Link
              href={`/admin/tournaments/${id}/check-in`}
              className="text-xs px-3 py-1.5 rounded-lg border border-emerald-500/30 hover:bg-emerald-500/10 transition-colors"
              style={{ color: '#10b981' }}
            >
              {t('scan_checkin_qr')}
            </Link>
          }
        >
          <RegistrationsManager tournamentId={id} weightCategories={tournament.weightCategories ?? []} t={t} />
        </Section>
      )}

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

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border border-white/10 p-6"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="font-bold text-white">{title}</h2>
        {action}
      </div>
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

// ─── Registrations Manager (pre-bracket) ────────────────

function RegistrationsManager({
  tournamentId,
  weightCategories,
  t,
}: {
  tournamentId: string;
  weightCategories: { id: string; name: string; minWeight: number | null; maxWeight: number | null }[];
  t: ReturnType<typeof useTranslations>;
}) {
  const { data: entriesRes, isLoading } = useConfirmedEntries(tournamentId);
  const reassign = useAdminReassignEntry(tournamentId);
  const checkIn = useAdminCheckInEntry(tournamentId);
  const undoCheckIn = useAdminUndoCheckIn(tournamentId);
  const entries = entriesRes?.data ?? [];

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeightCategoryId, setEditWeightCategoryId] = useState<string>('');
  const [editHand, setEditHand] = useState<'left' | 'right' | ''>('');
  const [editAgeGroup, setEditAgeGroup] = useState<'juniors' | 'adults' | 'veterans' | ''>('');
  const [editWeightKg, setEditWeightKg] = useState<string>('');
  const [editReason, setEditReason] = useState('');

  if (isLoading) {
    return <Skeleton className="h-20 w-full rounded-xl" />;
  }
  if (entries.length === 0) {
    return (
      <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {t('no_registrations')}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((e) => {
        const isEditing = editingId === e.id;
        const pName = `${e.user?.firstName ?? ''} ${e.user?.lastName ?? ''}`.trim() || '—';
        return (
          <div
            key={e.id}
            className="rounded-xl border border-white/8 p-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm text-white font-medium flex items-center gap-2">
                  {pName}
                  {e.status === 'checked_in' && (
                    <span
                      className="text-[10px] font-black px-1.5 py-0.5 rounded-full"
                      style={{ color: '#10b981', backgroundColor: 'rgba(16,185,129,0.12)' }}
                    >
                      ✓ {t('checked_in_badge')}
                    </span>
                  )}
                </p>
                <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
                  {e.ageGroup ?? '—'} · {e.hand ?? '—'}
                  {e.weightKg ? ` · ${e.weightKg} ${t('kg_suffix')}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {/* Check-in / undo — flips entry.status between confirmed and checked_in */}
                {e.status === 'checked_in' ? (
                  <button
                    disabled={undoCheckIn.isPending}
                    onClick={() => undoCheckIn.mutate(e.id)}
                    className="text-xs px-2 py-1 rounded-lg border transition-colors disabled:opacity-50"
                    style={{
                      borderColor: 'rgba(239,68,68,0.3)',
                      color: '#f87171',
                    }}
                  >
                    {t('undo_checkin_btn')}
                  </button>
                ) : (
                  <button
                    disabled={checkIn.isPending}
                    onClick={() => checkIn.mutate(e.id)}
                    className="text-xs px-2 py-1 rounded-lg border transition-colors disabled:opacity-50"
                    style={{
                      borderColor: 'rgba(16,185,129,0.3)',
                      color: '#10b981',
                    }}
                  >
                    {t('checkin_btn')}
                  </button>
                )}
                <button
                  onClick={() => {
                    setEditingId(isEditing ? null : e.id);
                    setEditWeightCategoryId('');
                    setEditHand('');
                    setEditAgeGroup('');
                    setEditWeightKg(e.weightKg ? String(e.weightKg) : '');
                    setEditReason('');
                  }}
                  className="text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                  style={{ color: '#60a5fa' }}
                >
                  {isEditing ? t('cancel') : t('reassign_btn')}
                </button>
              </div>
            </div>

            {isEditing && (
              <div className="mt-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editAgeGroup}
                    onChange={(ev) => setEditAgeGroup(ev.target.value as typeof editAgeGroup)}
                    className="px-2 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none"
                  >
                    <option value="" className="bg-black">
                      {t('reassign_age_placeholder')}
                    </option>
                    <option value="juniors" className="bg-black">juniors</option>
                    <option value="adults" className="bg-black">adults</option>
                    <option value="veterans" className="bg-black">veterans</option>
                  </select>
                  <select
                    value={editHand}
                    onChange={(ev) => setEditHand(ev.target.value as typeof editHand)}
                    className="px-2 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none"
                  >
                    <option value="" className="bg-black">
                      {t('reassign_hand_placeholder')}
                    </option>
                    <option value="left" className="bg-black">left</option>
                    <option value="right" className="bg-black">right</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editWeightCategoryId}
                    onChange={(ev) => setEditWeightCategoryId(ev.target.value)}
                    className="px-2 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none"
                  >
                    <option value="" className="bg-black">
                      {t('reassign_cat_placeholder')}
                    </option>
                    {weightCategories.map((wc) => (
                      <option key={wc.id} value={wc.id} className="bg-black">
                        {wc.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min="20"
                    max="300"
                    step="0.1"
                    value={editWeightKg}
                    onChange={(ev) => setEditWeightKg(ev.target.value)}
                    placeholder={t('reassign_weight_placeholder')}
                    className="px-2 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none"
                  />
                </div>
                <input
                  value={editReason}
                  onChange={(ev) => setEditReason(ev.target.value)}
                  placeholder={t('reassign_reason_placeholder')}
                  className="w-full px-2 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none"
                />
                <div className="flex gap-2">
                  <button
                    disabled={reassign.isPending || editReason.trim().length < 3}
                    onClick={() => {
                      const payload: any = {
                        entryId: e.id,
                        reason: editReason.trim(),
                      };
                      if (editWeightCategoryId) payload.weightCategoryId = editWeightCategoryId;
                      if (editHand) payload.hand = editHand;
                      if (editAgeGroup) payload.ageGroup = editAgeGroup;
                      if (editWeightKg) payload.weightKg = Number(editWeightKg);
                      reassign.mutate(payload, {
                        onSuccess: () => setEditingId(null),
                      });
                    }}
                    className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 disabled:opacity-40"
                  >
                    {reassign.isPending ? '...' : t('save')}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:bg-white/5"
                    style={{ color: 'var(--color-text-secondary)' }}
                  >
                    {t('cancel')}
                  </button>
                </div>
                {reassign.error && (
                  <p className="text-xs text-red-400">
                    {(reassign.error as any)?.response?.data?.message}
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
  const locale = useLocale();
  const lockMutation = useAdminLockBracket(bracketId, tournamentId);
  const startCategory = useAdminStartCategory(bracketId, tournamentId);
  const resetMatch = useAdminResetMatch(bracketId, tournamentId);
  const correctResult = useAdminCorrectResult(bracketId, tournamentId);
  const replacePlayer = useAdminReplacePlayer(bracketId, tournamentId);
  const withdrawPlayer = useAdminWithdrawPlayer(bracketId, tournamentId);
  const { data: confirmedEntriesRes } = useConfirmedEntries(tournamentId);
  const confirmedEntries = confirmedEntriesRes?.data ?? [];
  const { data: auditLog } = useAdminBracketAuditLog(bracketId);

  // Once the user has clicked "Start category" + confirmed, we surface the
  // returned forfeit summary in a small banner below the status bar.
  const [startResult, setStartResult] = useState<ReturnType<
    typeof useAdminStartCategory
  >['data'] | null>(null);
  const [confirmStart, setConfirmStart] = useState(false);
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

  // Replace / withdraw state
  const [replaceState, setReplaceState] = useState<{
    matchId: string;
    position: 1 | 2;
    currentName: string;
  } | null>(null);
  const [replaceEntryId, setReplaceEntryId] = useState('');
  const [replaceReason, setReplaceReason] = useState('');
  const [withdrawState, setWithdrawState] = useState<{
    matchId: string;
    position: 1 | 2;
    playerName: string;
    opponentName: string;
  } | null>(null);
  const [withdrawReason, setWithdrawReason] = useState('');

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

  // Editable = unplayed real-player matches (replace/withdraw applies here).
  const editableMatches = allMatches.filter(
    (r) =>
      !r.match.winner &&
      r.match.player1.id !== 'tbd' &&
      r.match.player2.id !== 'tbd' &&
      r.match.player1.id !== 'bye' &&
      r.match.player2.id !== 'bye',
  );

  // Entries currently placed in this bracket — excluded from replacement picker.
  const placedEntryIds = new Set<string>();
  allMatches.forEach((r) => {
    if (r.match.player1.id && r.match.player1.id !== 'tbd' && r.match.player1.id !== 'bye') {
      placedEntryIds.add(r.match.player1.id);
    }
    if (r.match.player2.id && r.match.player2.id !== 'tbd' && r.match.player2.id !== 'bye') {
      placedEntryIds.add(r.match.player2.id);
    }
  });

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
            · {new Date(bracket.lastModifiedAt).toLocaleString(locale)}
          </span>
        )}

        {/* Start category — auto-forfeit no-shows */}
        <button
          onClick={() => setConfirmStart(true)}
          disabled={startCategory.isPending || bracket.isLocked}
          className="ml-auto px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50"
          style={{
            borderColor: 'rgba(16,185,129,0.4)',
            color: '#10b981',
          }}
        >
          {startCategory.isPending ? '...' : t('start_category_btn')}
        </button>

        {/* Lock / Unlock */}
        <button
          onClick={() => lockMutation.mutate(!bracket.isLocked)}
          disabled={lockMutation.isPending}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors disabled:opacity-50"
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

      {/* Start-category confirm + result */}
      {confirmStart && !startResult && (
        <div className="rounded-xl p-3 border border-emerald-500/30 bg-emerald-500/5">
          <p className="text-sm text-emerald-200 mb-2">{t('start_category_confirm')}</p>
          <div className="flex gap-2">
            <button
              onClick={() =>
                startCategory.mutate(undefined, {
                  onSuccess: (data) => {
                    setStartResult(data);
                    setConfirmStart(false);
                  },
                })
              }
              disabled={startCategory.isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/20 text-emerald-200 disabled:opacity-50"
            >
              {startCategory.isPending ? '...' : t('start_category_go')}
            </button>
            <button
              onClick={() => setConfirmStart(false)}
              className="px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('cancel')}
            </button>
          </div>
          {startCategory.error && (
            <p className="mt-2 text-xs text-red-400">
              {(startCategory.error as any)?.response?.data?.message ?? t('error')}
            </p>
          )}
        </div>
      )}

      {startResult && (
        <div
          className="rounded-xl p-3 border text-sm space-y-1"
          style={{
            borderColor: startResult.errors.length
              ? 'rgba(239,68,68,0.4)'
              : 'rgba(16,185,129,0.3)',
            backgroundColor: startResult.errors.length
              ? 'rgba(239,68,68,0.05)'
              : 'rgba(16,185,129,0.05)',
          }}
        >
          {!startResult.requireCheckIn ? (
            <p style={{ color: 'var(--color-text-secondary)' }}>
              {t('start_category_not_required')}
            </p>
          ) : (
            <>
              <p className="font-semibold text-white">
                {t('start_category_result', { n: startResult.withdrawn.length })}
              </p>
              {startResult.doubleNoShow.length > 0 && (
                <p style={{ color: '#fbbf24' }}>
                  ⚠ {t('start_category_double_no_show', {
                    n: startResult.doubleNoShow.length,
                  })}
                </p>
              )}
              {startResult.errors.length > 0 && (
                <p className="text-red-400">
                  ✗ {t('start_category_errors', { n: startResult.errors.length })}
                </p>
              )}
            </>
          )}
          <button
            onClick={() => setStartResult(null)}
            className="text-xs underline"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('dismiss')}
          </button>
        </div>
      )}

      {/* Audit log */}
      {showAudit && auditLog && <AuditLogTable logs={auditLog} getPlayerName={getPlayerName} />}

      {/* Editable unplayed matches — replace or withdraw */}
      {editableMatches.length > 0 && !bracket.isLocked && (
        <div>
          <p
            className="text-xs font-bold uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('editable_matches')}
          </p>
          <div className="space-y-2">
            {editableMatches.map(({ match, label }) => {
              const replaceHere = replaceState?.matchId === match.id;
              const withdrawHere = withdrawState?.matchId === match.id;

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
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => {
                          setReplaceState({
                            matchId: match.id,
                            position: 1,
                            currentName: pName(match.player1),
                          });
                          setReplaceEntryId('');
                          setReplaceReason('');
                          setWithdrawState(null);
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                        style={{ color: '#60a5fa' }}
                      >
                        {t('replace_p1', { name: match.player1.firstName })}
                      </button>
                      <button
                        onClick={() => {
                          setReplaceState({
                            matchId: match.id,
                            position: 2,
                            currentName: pName(match.player2),
                          });
                          setReplaceEntryId('');
                          setReplaceReason('');
                          setWithdrawState(null);
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                        style={{ color: '#60a5fa' }}
                      >
                        {t('replace_p2', { name: match.player2.firstName })}
                      </button>
                      <button
                        onClick={() => {
                          setWithdrawState({
                            matchId: match.id,
                            position: 1,
                            playerName: pName(match.player1),
                            opponentName: pName(match.player2),
                          });
                          setWithdrawReason('');
                          setReplaceState(null);
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                        style={{ color: '#f87171' }}
                      >
                        {t('withdraw_p1', { name: match.player1.firstName })}
                      </button>
                      <button
                        onClick={() => {
                          setWithdrawState({
                            matchId: match.id,
                            position: 2,
                            playerName: pName(match.player2),
                            opponentName: pName(match.player1),
                          });
                          setWithdrawReason('');
                          setReplaceState(null);
                        }}
                        className="text-xs px-2 py-1 rounded-lg border border-white/10 hover:bg-white/5 transition-colors"
                        style={{ color: '#f87171' }}
                      >
                        {t('withdraw_p2', { name: match.player2.firstName })}
                      </button>
                    </div>
                  </div>

                  {/* Replace form */}
                  {replaceHere && replaceState && (
                    <div className="mt-3 p-3 rounded-xl bg-blue-500/5 border border-blue-500/20">
                      <p className="text-xs text-blue-300 mb-2">
                        {t('replace_title', { name: replaceState.currentName })}
                      </p>
                      <select
                        value={replaceEntryId}
                        onChange={(e) => setReplaceEntryId(e.target.value)}
                        className="w-full mb-2 px-3 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none"
                      >
                        <option value="" className="bg-black">
                          {t('replace_pick_placeholder')}
                        </option>
                        {confirmedEntries
                          .filter((e) => !placedEntryIds.has(e.id))
                          .map((e) => (
                            <option key={e.id} value={e.id} className="bg-black">
                              {e.user?.firstName} {e.user?.lastName}
                              {e.weightKg ? ` · ${e.weightKg} ${t('kg_suffix')}` : ''}
                            </option>
                          ))}
                      </select>
                      <input
                        value={replaceReason}
                        onChange={(e) => setReplaceReason(e.target.value)}
                        placeholder={t('replace_reason_placeholder')}
                        className="w-full mb-2 px-3 py-1.5 text-xs rounded-lg bg-transparent border border-white/10 text-white outline-none"
                      />
                      <div className="flex gap-2">
                        <button
                          disabled={
                            !replaceEntryId ||
                            replaceReason.trim().length < 3 ||
                            replacePlayer.isPending
                          }
                          onClick={() =>
                            replacePlayer.mutate(
                              {
                                matchId: replaceState.matchId,
                                position: replaceState.position,
                                newEntryId: replaceEntryId,
                                reason: replaceReason.trim(),
                              },
                              { onSuccess: () => setReplaceState(null) },
                            )
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-500/20 text-blue-300 disabled:opacity-40"
                        >
                          {replacePlayer.isPending ? '...' : t('save')}
                        </button>
                        <button
                          onClick={() => setReplaceState(null)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:bg-white/5"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {t('cancel')}
                        </button>
                      </div>
                      {replacePlayer.error && (
                        <p className="mt-2 text-xs text-red-400">
                          {(replacePlayer.error as any)?.response?.data?.message}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Withdraw form */}
                  {withdrawHere && withdrawState && (
                    <div className="mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
                      <p className="text-xs text-red-300 mb-2">
                        {t('withdraw_title', {
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
                          disabled={
                            withdrawReason.trim().length < 3 || withdrawPlayer.isPending
                          }
                          onClick={() =>
                            withdrawPlayer.mutate(
                              {
                                matchId: withdrawState.matchId,
                                position: withdrawState.position,
                                reason: withdrawReason.trim(),
                              },
                              { onSuccess: () => setWithdrawState(null) },
                            )
                          }
                          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-red-500/20 text-red-300 disabled:opacity-40"
                        >
                          {withdrawPlayer.isPending ? '...' : t('save')}
                        </button>
                        <button
                          onClick={() => setWithdrawState(null)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-white/10 hover:bg-white/5"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {t('cancel')}
                        </button>
                      </div>
                      {withdrawPlayer.error && (
                        <p className="mt-2 text-xs text-red-400">
                          {(withdrawPlayer.error as any)?.response?.data?.message}
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
                          disabled={
                            !correctWinnerId ||
                            correctReason.trim().length < 3 ||
                            correctResult.isPending
                          }
                          onClick={() =>
                            correctResult.mutate(
                              {
                                matchId: match.id,
                                winnerId: correctWinnerId,
                                reason: correctReason.trim(),
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
  const locale = useLocale();
  const actionLabel: Record<string, string> = {
    result_recorded: t('action_result_recorded'),
    result_corrected: t('action_result_corrected'),
    match_reset: t('action_match_reset'),
    bracket_reset: t('action_bracket_reset'),
    bracket_locked: t('action_bracket_locked'),
    bracket_unlocked: t('action_bracket_unlocked'),
    player_replaced: t('action_player_replaced'),
    player_withdrawn: t('action_player_withdrawn'),
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
              {new Date(log.createdAt).toLocaleString(locale)}
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
