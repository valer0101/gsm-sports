'use client';

import { useState, use } from 'react';
import Link from 'next/link';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
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
  useUpdateTournament,
  useDeleteTournament,
  useCancelTournament,
} from '@/hooks/useAdmin';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { isArmfightTournament } from '@/lib/armfight';
import { Skeleton } from '@/components/ui/Skeleton';
import { CountryLabel } from '@/components/ui/CountryLabel';
import { WeighInsManager } from '@/components/admin/WeighInsManager';
import type {
  Bracket,
  BracketMatch,
  BracketAuditLog,
  SportBracketFormat,
} from '@/types/api';

/**
 * Bracket-format generators wired through the API. As of Phase 3.3d
 * every member of the `BracketFormat` union has a generator. The
 * dropdown still filters against `tournament.sport.config.bracketFormats`
 * so a sport that doesn't list a given format won't expose it.
 */
const IMPLEMENTED_FORMATS: ReadonlySet<SportBracketFormat> = new Set([
  'single_elim',
  'double_elim',
  'round_robin',
  'swiss',
  'groups_playoff',
]);

export default function AdminTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('admin_tournament');
  const tAdmin = useTranslations('admin');
  const locale = useLocale();
  const router = useRouter();
  const { data: tournament, isLoading } = useAdminTournament(id);
  const { data: confirmedRes } = useConfirmedEntries(id);
  const toggleReg = useToggleRegistration(id);
  const generateBrackets = useGenerateBrackets(id);
  const { data: operators } = useAdminOperators(id);
  const { data: brackets } = useAdminBrackets(id);
  const assignOp = useAssignOperator(id);
  const removeOp = useRemoveOperator(id);
  const updateTournament = useUpdateTournament(id);
  const cancelTournament = useCancelTournament(id);
  const deleteTournament = useDeleteTournament();

  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [operatorEmail, setOperatorEmail] = useState('');
  const [assignError, setAssignError] = useState('');
  const [selectedBracketId, setSelectedBracketId] = useState<string | null>(null);
  const [generateFormat, setGenerateFormat] = useState<SportBracketFormat | ''>('');
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDescription, setShowDescription] = useState(false);
  const [descriptionLocale, setDescriptionLocale] = useState<'ru' | 'en' | 'hy'>(
    locale === 'en' || locale === 'hy' ? locale : 'ru',
  );

  // Restrict the dropdown to formats that are BOTH allowed for the
  // sport AND have a generator landed today.
  const formatOptions: SportBracketFormat[] = (
    tournament?.sport?.config?.bracketFormats ?? []
  ).filter((f) => IMPLEMENTED_FORMATS.has(f));

  // Resolve the "sport default" label exactly like the API gate does
  // (Phase 3.3a slice 2 #54): per-tournament `sportConfig` override wins
  // over the sport-wide default. Without this mirror the dropdown
  // displays "Sport default (Double elimination)" while the backend
  // would actually run `single_elim` because of an event-level override.
  const tournamentOverrideFormat = (
    tournament?.sportConfig as { defaultBracketFormat?: SportBracketFormat } | null
  )?.defaultBracketFormat;
  const resolvedDefault: SportBracketFormat =
    tournamentOverrideFormat ??
    tournament?.sport?.config?.defaultBracketFormat ??
    'double_elim';
  const defaultIsImplemented = IMPLEMENTED_FORMATS.has(resolvedDefault);

  const { data: currentUser } = useCurrentUser();
  const isAdmin = (currentUser?.roles ?? []).includes('admin');

  // When bracket generation is blocked by the weigh-in gate the API returns
  // `{ code: 'WEIGH_IN_REQUIRED', unweighedEntryIds }`. We surface the ids to
  // the WeighInsManager so the unweighed rows get a red ring.
  const generateErrorData = (generateBrackets.error as any)?.response?.data as
    | { code?: string; message?: string; unweighedEntryIds?: string[] }
    | undefined;
  const weighInBlockedIds =
    generateErrorData?.code === 'WEIGH_IN_REQUIRED'
      ? (generateErrorData.unweighedEntryIds ?? [])
      : [];

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
  const isArmfight = isArmfightTournament(tournament as any);
  // The single-bracket `BracketsService.generate()` path (which armfight uses)
  // never sets `tournament.bracketGenerated = true`; only `generateAll` does.
  // For armfight, detect bracket existence directly from the brackets list so
  // the CTA hides correctly post-creation.
  const hasArmfightBracket =
    isArmfight &&
    (brackets ?? []).some((b) => (b.bracketData as any)?.format === 'armfight');
  const showGenerateCta =
    !tournament.registrationOpen &&
    (isArmfight ? !hasArmfightBracket : !tournament.bracketGenerated);

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
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link
          href="/admin"
          className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {t('back')}
        </Link>
        {tournament.bracketGenerated ? (
          <span
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-muted)] cursor-not-allowed"
            title={t('edit_locked_after_bracket')}
          >
            ✏️ {t('edit_link')}
          </span>
        ) : (
          <Link
            href={`/admin/tournaments/${id}/edit`}
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
          >
            ✏️ {t('edit_link')}
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] overflow-hidden">
        {tournament.posterUrl && (
          <div
            className="h-32 sm:h-40 w-full bg-cover bg-center"
            style={{
              backgroundImage: `linear-gradient(180deg, rgba(15,15,26,0.45) 0%, var(--color-surface) 100%), url(${tournament.posterUrl})`,
            }}
          />
        )}
        <div className="p-4 sm:p-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <h1 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tight">
                {tournament.name}
              </h1>
              <p className="text-sm mt-1.5 inline-flex items-center gap-1.5 flex-wrap text-[var(--color-text-secondary)]">
                {tournament.city && <span>{tournament.city}{tournament.country ? ',' : ''}</span>}
                {tournament.country && <CountryLabel value={tournament.country} />}
                {(tournament.city || tournament.country) && <span className="text-[var(--color-text-muted)]">·</span>}
                <span>{new Date(tournament.startDate).toLocaleDateString(locale)}</span>
              </p>
            </div>
            <StatusBadge status={tournament.status} tAdmin={tAdmin} />
          </div>

          {/* Stats */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-5 border-t border-[var(--color-border)]">
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
            <Stat
              label={t('stat_participants')}
              value={
                tournament.maxParticipants
                  ? `${confirmedRes?.data.length ?? 0} / ${tournament.maxParticipants}`
                  : `${confirmedRes?.data.length ?? 0}`
              }
            />
          </dl>
        </div>
      </div>

      {/* Tournament setup overview */}
      <SetupOverview
        tournament={tournament}
        showDescription={showDescription}
        setShowDescription={setShowDescription}
        descriptionLocale={descriptionLocale}
        setDescriptionLocale={setDescriptionLocale}
        onToggleFeatured={() =>
          updateTournament.mutate({ isFeatured: !tournament.isFeatured } as never)
        }
        toggleFeaturedPending={updateTournament.isPending}
        t={t}
      />

      {/* Registration control */}
      <Section title={t('manage_registration')}>
        <div className="flex flex-wrap gap-3 items-center">
          <button
            disabled={!canToggleReg || toggleReg.isPending}
            onClick={() => toggleReg.mutate()}
            className={[
              'px-4 py-2.5 rounded-md text-sm font-bold transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
              tournament.registrationOpen
                ? 'border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 text-[var(--color-error)] hover:bg-[var(--color-error)]/15'
                : 'bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]',
            ].join(' ')}
          >
            {toggleReg.isPending
              ? t('updating')
              : tournament.registrationOpen
                ? t('close_registration')
                : t('open_registration')}
          </button>

          {showGenerateCta && (
            isArmfight ? (
              <Link
                href={`/admin/tournaments/${tournament.id}/armfight-pairs`}
                className="px-4 py-2.5 rounded-md text-sm font-bold border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
              >
                {t('build_pairs_and_generate')}
              </Link>
            ) : (
              <button
                onClick={() => setShowGenerateConfirm(true)}
                className="px-4 py-2.5 rounded-md text-sm font-bold border border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15 transition-colors"
              >
                {t('generate_btn')}
              </button>
            )
          )}

          {(tournament.bracketGenerated || hasArmfightBracket) && (
            <span className="text-sm font-semibold text-[var(--color-success)]">
              {t('bracket_generated_badge')}
            </span>
          )}
        </div>

        {/* Generate confirm dialog */}
        {!isArmfight && showGenerateConfirm && (
          <div className="mt-4 p-4 rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)]">
            <p className="text-[var(--color-text-primary)] font-semibold mb-1">{t('generate_confirm_title')}</p>
            <p className="text-sm mb-4 text-[var(--color-text-secondary)]">
              {t('generate_confirm_desc')}
            </p>

            {/* Format selector — visible whenever there's a real choice to
                make OR the resolved sport default isn't yet implemented
                (e.g. chess defaults to `swiss` which would 400 server-side;
                an admin needs the dropdown to pick `single_elim` instead). */}
            {formatOptions.length >= 1 &&
              (formatOptions.length > 1 || !defaultIsImplemented) && (
                <div className="mb-4">
                  <label className="block text-[10px] font-bold uppercase tracking-[0.12em] mb-1.5 text-[var(--color-text-muted)]">
                    {t('format_label')}
                  </label>
                  <select
                    value={generateFormat}
                    onChange={(e) =>
                      setGenerateFormat(e.target.value as SportBracketFormat | '')
                    }
                    className="w-full px-3 py-2 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-primary)]"
                  >
                    {/* Only offer "Sport default" when the resolved default is
                        actually implementable — otherwise the empty submit
                        path would 400. The "default" label uses the
                        per-tournament override (mirrors the API resolver). */}
                    {defaultIsImplemented && (
                      <option value="" className="bg-[var(--color-surface)]">
                        {t('format_default', {
                          name: t(`format_name_${resolvedDefault}`),
                        })}
                      </option>
                    )}
                    {formatOptions.map((f) => (
                      <option key={f} value={f} className="bg-[var(--color-surface)]">
                        {t(`format_name_${f}`)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

            <div className="flex gap-2">
              <button
                disabled={generateBrackets.isPending}
                onClick={() => {
                  // Effective format: explicit pick → use it. No pick + default
                  // is implemented → omit (server falls back). No pick +
                  // default would 400 → fall back to the first implemented
                  // format the sport allows so the admin doesn't dead-end.
                  const effective: SportBracketFormat | undefined = generateFormat
                    ? generateFormat
                    : defaultIsImplemented
                      ? undefined
                      : formatOptions[0];
                  generateBrackets.mutate(
                    effective ? { bracketFormat: effective } : undefined,
                    {
                      onSuccess: () => setShowGenerateConfirm(false),
                    },
                  );
                }}
                className="px-4 py-2 rounded-md text-sm font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generateBrackets.isPending ? t('generating') : t('confirm')}
              </button>
              <button
                onClick={() => setShowGenerateConfirm(false)}
                className="px-4 py-2 rounded-md text-sm text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {t('cancel')}
              </button>
            </div>
            {generateBrackets.isSuccess && (
              <p className="mt-2 text-sm text-[var(--color-success)]">
                {t('generated_count', {
                  count: (generateBrackets.data as any)?.bracketsCreated ?? 0,
                })}
              </p>
            )}
            {generateBrackets.error && (
              <p className="mt-2 text-sm text-[var(--color-error)]">
                {generateErrorData?.code === 'WEIGH_IN_REQUIRED'
                  ? t('weigh_in_required_error', {
                      count: generateErrorData.unweighedEntryIds?.length ?? 0,
                    })
                  : (generateErrorData?.message ?? t('error'))}
              </p>
            )}
          </div>
        )}
      </Section>

      {/* Operators */}
      <Section title={t('operators_title')}>
        {operators && operators.length > 0 ? (
          <div className="divide-y divide-[var(--color-border)] mb-4">
            {operators.map((op) => (
              <div key={op.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[var(--color-text-primary)] font-medium">
                    {op.user ? `${op.user.firstName} ${op.user.lastName}` : op.operatorId}
                  </p>
                  <p className="text-xs text-[var(--color-text-secondary)]">
                    {op.user?.email}
                  </p>
                </div>
                <button
                  onClick={() => removeOp.mutate(op.operatorId)}
                  className="text-xs px-3 py-1.5 rounded-md text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors"
                >
                  {t('remove_operator')}
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm mb-4 text-[var(--color-text-secondary)]">
            {t('no_operators')}
          </p>
        )}

        {/* Assign form */}
        <form onSubmit={handleAssignOperator} className="flex flex-col sm:flex-row gap-2">
          <input
            type="email"
            value={operatorEmail}
            onChange={(e) => {
              setOperatorEmail(e.target.value);
              setAssignError('');
            }}
            placeholder={t('operator_email_placeholder')}
            required
            className="flex-1 min-w-0 px-4 py-2.5 rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] text-sm outline-none focus:border-[var(--color-primary)] transition-colors"
          />
          <button
            type="submit"
            disabled={assignOp.isPending}
            className="px-4 py-2.5 rounded-md text-sm font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0"
          >
            {assignOp.isPending ? '...' : t('assign_btn')}
          </button>
        </form>
        {assignError && <p className="mt-2 text-xs text-[var(--color-error)]">{assignError}</p>}
      </Section>

      {/* Registrations management — only available before bracket is generated */}
      {!tournament.bracketGenerated && (
        <Section
          title={t('registrations_title')}
          action={
            <Link
              href={`/admin/tournaments/${id}/check-in`}
              className="text-xs px-3 py-1.5 rounded-md border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/15 transition-colors"
            >
              {t('scan_checkin_qr')}
            </Link>
          }
        >
          <RegistrationsManager tournamentId={id} weightCategories={tournament.weightCategories ?? []} t={t} />
        </Section>
      )}

      {/* Weigh-ins — sports that require them, before bracket is generated.
          Resolution order matches the API gate (`assertAllWeighedIn` in
          BracketsService): per-tournament `sportConfig` override wins over
          the sport-wide default. Without this client mirror, an organizer
          who set `tournament.sportConfig.weighInRequired = true` on a
          chess event would be locked out of the bracket gate with no UI
          to record weigh-ins. */}
      {!tournament.bracketGenerated &&
        ((tournament.sportConfig as { weighInRequired?: boolean } | null)?.weighInRequired ??
          tournament.sport?.config.weighInRequired) && (
          <Section title={t('weigh_ins_title')}>
            <WeighInsManager
              tournamentId={id}
              canUndo={isAdmin}
              highlightEntryIds={weighInBlockedIds}
            />
          </Section>
        )}

      {/* Bracket management — visible after bracket is generated */}
      {tournament.bracketGenerated && brackets && brackets.length > 0 && (
        <Section title={t('bracket_management_title')}>
          {/* Bracket selector */}
          {brackets.length > 1 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {brackets.map((b) => {
                const active = selectedBracketId === b.id;
                return (
                  <button
                    key={b.id}
                    onClick={() => setSelectedBracketId(active ? null : b.id)}
                    className={[
                      'shrink-0 px-3 py-1.5 rounded-full text-sm border transition-colors',
                      active
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-dim)] text-[var(--color-primary)]'
                        : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)] hover:text-[var(--color-text-primary)]',
                    ].join(' ')}
                  >
                    {b.name ?? b.weightCategory?.name ?? `Bracket`}
                    {b.isLocked && ' 🔒'}
                  </button>
                );
              })}
            </div>
          )}

          {/* Single bracket — auto-select */}
          {brackets.length === 1 && !selectedBracketId && (
            <button
              onClick={() => setSelectedBracketId(brackets[0].id)}
              className="mb-4 px-4 py-2 rounded-md text-sm border border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
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

      {/* Danger zone — terminal actions.
          Wrap the dialog setters so closing the dialog (setting to `false`)
          also resets the corresponding mutation. Without this, a failed
          attempt leaves `mutation.error` populated and the next time the
          admin opens the same dialog they see a stale error from the
          previous attempt. Opening (setting to `true`) is unwrapped — there
          is nothing to reset yet. */}
      <DangerZone
        canDelete={!['active', 'completed', 'cancelled'].includes(tournament.status)}
        canCancel={!['cancelled', 'completed'].includes(tournament.status)}
        showCancelConfirm={showCancelConfirm}
        setShowCancelConfirm={(v) => {
          if (!v) cancelTournament.reset();
          setShowCancelConfirm(v);
        }}
        showDeleteConfirm={showDeleteConfirm}
        setShowDeleteConfirm={(v) => {
          if (!v) deleteTournament.reset();
          setShowDeleteConfirm(v);
        }}
        cancelPending={cancelTournament.isPending}
        deletePending={deleteTournament.isPending}
        onCancel={() => cancelTournament.mutate(undefined, { onSuccess: () => setShowCancelConfirm(false) })}
        onDelete={() =>
          deleteTournament.mutate(id, {
            onSuccess: () => router.push('/admin/tournaments'),
          })
        }
        cancelError={(cancelTournament.error as any)?.response?.data?.message}
        deleteError={(deleteTournament.error as any)?.response?.data?.message}
        t={t}
      />

      {/* View public page link */}
      <div className="text-center">
        <Link
          href={`/tournaments/${tournament.slug}`}
          target="_blank"
          className="text-sm underline text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
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
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-primary)]">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)] mb-1">
        {label}
      </dt>
      <dd className="text-sm font-semibold text-[var(--color-text-primary)]">{value}</dd>
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
          <div key={e.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <p className="text-sm text-[var(--color-text-primary)] font-medium flex items-center gap-2">
                  {pName}
                  {e.status === 'checked_in' && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full text-[var(--color-success)] bg-[var(--color-success)]/12">
                      ✓ {t('checked_in_badge')}
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--color-text-secondary)]">
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
                    className="text-xs px-2 py-1 rounded-md border border-[var(--color-error)]/40 text-[var(--color-error)] hover:bg-[var(--color-error)]/10 transition-colors disabled:opacity-50"
                  >
                    {t('undo_checkin_btn')}
                  </button>
                ) : (
                  <button
                    disabled={checkIn.isPending}
                    onClick={() => checkIn.mutate(e.id)}
                    className="text-xs px-2 py-1 rounded-md border border-[var(--color-success)]/40 text-[var(--color-success)] hover:bg-[var(--color-success)]/10 transition-colors disabled:opacity-50"
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
                  className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
                >
                  {isEditing ? t('cancel') : t('reassign_btn')}
                </button>
              </div>
            </div>

            {isEditing && (
              <div className="mt-3 p-3 rounded-md bg-[var(--color-background)] border border-[var(--color-border)] space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editAgeGroup}
                    onChange={(ev) => setEditAgeGroup(ev.target.value as typeof editAgeGroup)}
                    className="px-2 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="" className="bg-[var(--color-surface)]">
                      {t('reassign_age_placeholder')}
                    </option>
                    <option value="juniors" className="bg-[var(--color-surface)]">juniors</option>
                    <option value="adults" className="bg-[var(--color-surface)]">adults</option>
                    <option value="veterans" className="bg-[var(--color-surface)]">veterans</option>
                  </select>
                  <select
                    value={editHand}
                    onChange={(ev) => setEditHand(ev.target.value as typeof editHand)}
                    className="px-2 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="" className="bg-[var(--color-surface)]">
                      {t('reassign_hand_placeholder')}
                    </option>
                    <option value="left" className="bg-[var(--color-surface)]">left</option>
                    <option value="right" className="bg-[var(--color-surface)]">right</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={editWeightCategoryId}
                    onChange={(ev) => setEditWeightCategoryId(ev.target.value)}
                    className="px-2 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
                  >
                    <option value="" className="bg-[var(--color-surface)]">
                      {t('reassign_cat_placeholder')}
                    </option>
                    {weightCategories.map((wc) => (
                      <option key={wc.id} value={wc.id} className="bg-[var(--color-surface)]">
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
                    className="px-2 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
                  />
                </div>
                <input
                  value={editReason}
                  onChange={(ev) => setEditReason(ev.target.value)}
                  placeholder={t('reassign_reason_placeholder')}
                  className="w-full px-2 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
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
                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {reassign.isPending ? '...' : t('save')}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 rounded-md text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    {t('cancel')}
                  </button>
                </div>
                {reassign.error && (
                  <p className="text-xs text-[var(--color-error)]">
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
        <span className="text-sm text-[var(--color-text-secondary)]">
          {t('modifications_count', { n: bracket.modificationCount ?? 0 })}
        </span>
        {bracket.lastModifiedAt && (
          <span className="text-sm text-[var(--color-text-muted)]">
            · {new Date(bracket.lastModifiedAt).toLocaleString(locale)}
          </span>
        )}

        {/* Start category — auto-forfeit no-shows */}
        <button
          onClick={() => setConfirmStart(true)}
          disabled={startCategory.isPending || bracket.isLocked}
          className="ml-auto px-3 py-1.5 rounded-md text-xs font-bold border border-[var(--color-success)]/40 bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/15 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {startCategory.isPending ? '...' : t('start_category_btn')}
        </button>

        {/* Lock / Unlock */}
        <button
          onClick={() => lockMutation.mutate(!bracket.isLocked)}
          disabled={lockMutation.isPending}
          className={[
            'px-3 py-1.5 rounded-md text-xs font-bold border transition-colors disabled:opacity-50',
            bracket.isLocked
              ? 'border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/15'
              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]',
          ].join(' ')}
        >
          {bracket.isLocked ? t('unlock_bracket') : t('lock_bracket')}
        </button>

        {/* Audit log */}
        <button
          onClick={() => setShowAudit((v) => !v)}
          className="px-3 py-1.5 rounded-md text-xs border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          {showAudit ? t('audit_hide') : t('audit_show')}
        </button>
      </div>

      {/* Start-category confirm + result */}
      {confirmStart && !startResult && (
        <div className="rounded-md p-3 border border-[var(--color-success)]/40 bg-[var(--color-success)]/5">
          <p className="text-sm text-[var(--color-text-primary)] mb-2">{t('start_category_confirm')}</p>
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
              className="px-3 py-1.5 rounded-md text-xs font-bold bg-[var(--color-success)]/20 text-[var(--color-success)] hover:bg-[var(--color-success)]/30 disabled:opacity-50 transition-colors"
            >
              {startCategory.isPending ? '...' : t('start_category_go')}
            </button>
            <button
              onClick={() => setConfirmStart(false)}
              className="px-3 py-1.5 rounded-md text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {t('cancel')}
            </button>
          </div>
          {startCategory.error && (
            <p className="mt-2 text-xs text-[var(--color-error)]">
              {(startCategory.error as any)?.response?.data?.message ?? t('error')}
            </p>
          )}
        </div>
      )}

      {startResult && (
        <div
          className={[
            'rounded-md p-3 border text-sm space-y-1',
            startResult.errors.length
              ? 'border-[var(--color-error)]/40 bg-[var(--color-error)]/5'
              : 'border-[var(--color-success)]/30 bg-[var(--color-success)]/5',
          ].join(' ')}
        >
          {!startResult.requireCheckIn ? (
            <p className="text-[var(--color-text-secondary)]">
              {t('start_category_not_required')}
            </p>
          ) : (
            <>
              <p className="font-semibold text-[var(--color-text-primary)]">
                {t('start_category_result', { n: startResult.withdrawn.length })}
              </p>
              {startResult.doubleNoShow.length > 0 && (
                <p className="text-[var(--color-warning)]">
                  ⚠ {t('start_category_double_no_show', {
                    n: startResult.doubleNoShow.length,
                  })}
                </p>
              )}
              {startResult.errors.length > 0 && (
                <p className="text-[var(--color-error)]">
                  ✗ {t('start_category_errors', { n: startResult.errors.length })}
                </p>
              )}
            </>
          )}
          <button
            onClick={() => setStartResult(null)}
            className="text-xs underline text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
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
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2 text-[var(--color-text-muted)]">
            {t('editable_matches')}
          </p>
          <div className="space-y-2">
            {editableMatches.map(({ match, label }) => {
              const replaceHere = replaceState?.matchId === match.id;
              const withdrawHere = withdrawState?.matchId === match.id;

              return (
                <div key={match.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-xs mr-2 text-[var(--color-text-muted)]">
                        {label}
                      </span>
                      <span className="text-sm text-[var(--color-text-primary)]">
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
                        className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[#60a5fa] hover:bg-[#60a5fa]/10 hover:border-[#60a5fa]/40 transition-colors"
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
                        className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[#60a5fa] hover:bg-[#60a5fa]/10 hover:border-[#60a5fa]/40 transition-colors"
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
                        className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10 hover:border-[var(--color-error)]/40 transition-colors"
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
                        className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10 hover:border-[var(--color-error)]/40 transition-colors"
                      >
                        {t('withdraw_p2', { name: match.player2.firstName })}
                      </button>
                    </div>
                  </div>

                  {/* Replace form */}
                  {replaceHere && replaceState && (
                    <div className="mt-3 p-3 rounded-md bg-[var(--color-background)] border border-[#60a5fa]/30">
                      <p className="text-xs text-[#60a5fa] mb-2">
                        {t('replace_title', { name: replaceState.currentName })}
                      </p>
                      <select
                        value={replaceEntryId}
                        onChange={(e) => setReplaceEntryId(e.target.value)}
                        className="w-full mb-2 px-3 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
                      >
                        <option value="" className="bg-[var(--color-surface)]">
                          {t('replace_pick_placeholder')}
                        </option>
                        {confirmedEntries
                          .filter((e) => !placedEntryIds.has(e.id))
                          .map((e) => (
                            <option key={e.id} value={e.id} className="bg-[var(--color-surface)]">
                              {e.user?.firstName} {e.user?.lastName}
                              {e.weightKg ? ` · ${e.weightKg} ${t('kg_suffix')}` : ''}
                            </option>
                          ))}
                      </select>
                      <input
                        value={replaceReason}
                        onChange={(e) => setReplaceReason(e.target.value)}
                        placeholder={t('replace_reason_placeholder')}
                        className="w-full mb-2 px-3 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
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
                          className="px-3 py-1.5 rounded-md text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {replacePlayer.isPending ? '...' : t('save')}
                        </button>
                        <button
                          onClick={() => setReplaceState(null)}
                          className="px-3 py-1.5 rounded-md text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                      {replacePlayer.error && (
                        <p className="mt-2 text-xs text-[var(--color-error)]">
                          {(replacePlayer.error as any)?.response?.data?.message}
                        </p>
                      )}
                    </div>
                  )}

                  {/* Withdraw form */}
                  {withdrawHere && withdrawState && (
                    <div className="mt-3 p-3 rounded-md bg-[var(--color-background)] border border-[var(--color-error)]/30">
                      <p className="text-xs text-[var(--color-error)] mb-2">
                        {t('withdraw_title', {
                          player: withdrawState.playerName,
                          opponent: withdrawState.opponentName,
                        })}
                      </p>
                      <input
                        value={withdrawReason}
                        onChange={(e) => setWithdrawReason(e.target.value)}
                        placeholder={t('withdraw_reason_placeholder')}
                        className="w-full mb-2 px-3 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
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
                          className="px-3 py-1.5 rounded-md text-xs font-bold bg-[var(--color-error)]/20 text-[var(--color-error)] hover:bg-[var(--color-error)]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {withdrawPlayer.isPending ? '...' : t('save')}
                        </button>
                        <button
                          onClick={() => setWithdrawState(null)}
                          className="px-3 py-1.5 rounded-md text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                      {withdrawPlayer.error && (
                        <p className="mt-2 text-xs text-[var(--color-error)]">
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
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2 text-[var(--color-text-muted)]">
            {t('played_matches')}
          </p>
          <div className="space-y-2">
            {playedMatches.map(({ match, label }) => {
              const winnerName = match.winner ? getPlayerName(match.winner) : '—';
              const isResetting = resetState?.matchId === match.id;
              const isCorrecting = correctState?.matchId === match.id;

              return (
                <div key={match.id} className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <span className="text-xs mr-2 text-[var(--color-text-muted)]">
                        {label}
                      </span>
                      <span className="text-sm text-[var(--color-text-primary)]">
                        {pName(match.player1)} vs {pName(match.player2)}
                      </span>
                      <span className="text-xs ml-2 text-[var(--color-success)]">→ {winnerName}</span>
                      {match.correctedAt && (
                        <span className="text-xs ml-2 text-[var(--color-warning)]">{t('corrected_badge')}</span>
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
                        className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 hover:border-[var(--color-accent)]/40 transition-colors"
                      >
                        {t('correct_result')}
                      </button>
                      <button
                        onClick={() => {
                          setResetState({ matchId: match.id, label });
                          setResetReason('');
                          setCorrectState(null);
                        }}
                        className="text-xs px-2 py-1 rounded-md border border-[var(--color-border)] text-[var(--color-error)] hover:bg-[var(--color-error)]/10 hover:border-[var(--color-error)]/40 transition-colors"
                      >
                        {t('reset_match')}
                      </button>
                    </div>
                  </div>

                  {/* Reset form */}
                  {isResetting && (
                    <div className="mt-3 p-3 rounded-md bg-[var(--color-background)] border border-[var(--color-error)]/30">
                      <p className="text-xs text-[var(--color-error)] mb-2">
                        {t.rich('reset_confirm', {
                          label,
                          strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                      </p>
                      <input
                        value={resetReason}
                        onChange={(e) => setResetReason(e.target.value)}
                        placeholder={t('reset_reason_placeholder')}
                        className="w-full mb-2 px-3 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
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
                          className="px-3 py-1.5 rounded-md text-xs font-bold bg-[var(--color-error)]/20 text-[var(--color-error)] hover:bg-[var(--color-error)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                          {resetMatch.isPending ? '...' : t('reset_confirm_btn')}
                        </button>
                        <button
                          onClick={() => setResetState(null)}
                          className="px-3 py-1.5 rounded-md text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Correct form */}
                  {isCorrecting && correctState && (
                    <div className="mt-3 p-3 rounded-md bg-[var(--color-background)] border border-[var(--color-accent)]/30">
                      <p className="text-xs text-[var(--color-accent)] mb-2">
                        {t.rich('correct_title', {
                          label,
                          strong: (chunks) => <strong>{chunks}</strong>,
                        })}
                      </p>
                      <div className="flex gap-2 mb-2">
                        <button
                          onClick={() => setCorrectWinnerId(correctState.player1Id)}
                          className={[
                            'flex-1 py-2 rounded-md text-xs border transition-colors',
                            correctWinnerId === correctState.player1Id
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary-dim)] text-[var(--color-primary)]'
                              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]',
                          ].join(' ')}
                        >
                          {correctState.player1Name}
                        </button>
                        <button
                          onClick={() => setCorrectWinnerId(correctState.player2Id)}
                          className={[
                            'flex-1 py-2 rounded-md text-xs border transition-colors',
                            correctWinnerId === correctState.player2Id
                              ? 'border-[var(--color-primary)] bg-[var(--color-primary-dim)] text-[var(--color-primary)]'
                              : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:border-[var(--color-border-strong)]',
                          ].join(' ')}
                        >
                          {correctState.player2Name}
                        </button>
                      </div>
                      <input
                        value={correctReason}
                        onChange={(e) => setCorrectReason(e.target.value)}
                        placeholder={t('correct_reason_placeholder')}
                        className="w-full mb-2 px-3 py-1.5 text-xs rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-primary)] outline-none focus:border-[var(--color-primary)]"
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
                          className="px-3 py-1.5 rounded-md text-xs font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                          {correctResult.isPending ? '...' : t('save')}
                        </button>
                        <button
                          onClick={() => setCorrectState(null)}
                          className="px-3 py-1.5 rounded-md text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                        >
                          {t('cancel')}
                        </button>
                      </div>
                      {correctResult.error && (
                        <p className="mt-2 text-xs text-[var(--color-error)]">
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
        <p className="text-sm text-[var(--color-text-secondary)]">
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
    <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] overflow-hidden">
      <div className="px-4 py-2 text-[10px] font-bold uppercase tracking-[0.12em] border-b border-[var(--color-border)] text-[var(--color-text-muted)]">
        {t('audit_title')}
      </div>
      <div className="divide-y divide-[var(--color-border)] max-h-64 overflow-y-auto">
        {logs.length === 0 && (
          <p className="px-4 py-3 text-xs text-[var(--color-text-secondary)]">
            {t('audit_empty')}
          </p>
        )}
        {logs.map((log) => (
          <div key={log.id} className="px-4 py-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs text-[var(--color-text-primary)] font-medium">
                {actionLabel[log.action] ?? log.action}
                {log.matchId && <span className="ml-1 text-[var(--color-text-muted)]">· {log.matchId}</span>}
              </p>
              {log.reason && (
                <p className="text-xs mt-0.5 text-[var(--color-text-secondary)]">
                  {log.reason}
                </p>
              )}
            </div>
            <p className="text-xs shrink-0 text-[var(--color-text-muted)]">
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
  // Combat Energy maps every status to one of the semantic tokens
  // (success/warning/error/primary/muted). `active` uses the sacred sport red
  // — that's the only place on the page where it's allowed outside CTAs.
  const tokenMap: Record<string, { bg: string; fg: string }> = {
    draft: { bg: 'rgba(106,106,128,0.16)', fg: 'var(--color-text-muted)' },
    upcoming: { bg: 'rgba(59,130,246,0.14)', fg: '#60a5fa' },
    registration_open: { bg: 'rgba(34,197,94,0.14)', fg: 'var(--color-success)' },
    registration_closed: { bg: 'rgba(245,158,11,0.14)', fg: 'var(--color-warning)' },
    bracket_ready: { bg: 'rgba(255,215,0,0.14)', fg: 'var(--color-accent)' },
    active: { bg: 'var(--color-primary-dim)', fg: 'var(--color-primary)' },
    completed: { bg: 'rgba(106,106,128,0.16)', fg: 'var(--color-text-muted)' },
  };
  const { bg, fg } = tokenMap[status] ?? tokenMap.draft;
  const label = tAdmin(`status_${status}` as any, { defaultValue: status });
  return (
    <span
      className="text-[10px] uppercase tracking-[0.12em] px-3 py-1 rounded-full font-bold shrink-0"
      style={{ backgroundColor: bg, color: fg }}
    >
      {label}
    </span>
  );
}

// ─── Setup overview (read-only summary of wizard config) ─────────

type Tournament = NonNullable<ReturnType<typeof useAdminTournament>['data']>;

function SetupOverview({
  tournament,
  showDescription,
  setShowDescription,
  descriptionLocale,
  setDescriptionLocale,
  onToggleFeatured,
  toggleFeaturedPending,
  t,
}: {
  tournament: Tournament;
  showDescription: boolean;
  setShowDescription: (v: boolean) => void;
  descriptionLocale: 'ru' | 'en' | 'hy';
  setDescriptionLocale: (v: 'ru' | 'en' | 'hy') => void;
  onToggleFeatured: () => void;
  toggleFeaturedPending: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  const sc = (tournament.sportConfig ?? {}) as {
    ageGroups?: Array<'juniors' | 'adults' | 'veterans'>;
    hands?: string[];
    entryFee?: { type?: 'free' | 'paid'; amount?: number | string | null; description?: string | null };
    prizes?: Array<{
      place: number;
      type: string;
      amount?: string | number;
      description?: string;
      // Optional override scope from the wizard: prize applies only to the
      // matching age group / weight category. Both can be missing → applies
      // to every bracket.
      ageGroup?: 'juniors' | 'adults' | 'veterans';
      weightCategoryId?: string;
    }>;
  };

  const handLabel = (() => {
    const hs = sc.hands ?? [];
    if (hs.length >= 2) return t('setup_hand_both');
    if (hs[0] === 'left') return t('setup_hand_left');
    if (hs[0] === 'right') return t('setup_hand_right');
    return t('setup_none');
  })();

  const ageLabel = (() => {
    if (!sc.ageGroups || sc.ageGroups.length === 0) return t('setup_none');
    return sc.ageGroups
      .map((g) => t(`setup_age_${g}` as any, { defaultValue: g }))
      .join(', ');
  })();

  const genders = Array.from(
    new Set((tournament.weightCategories ?? []).map((c) => c.gender)),
  ).filter((g) => g === 'male' || g === 'female');
  const genderLabel = genders.length === 0
    ? t('setup_none')
    : genders.map((g) => t(`setup_gender_${g}` as any)).join(', ');

  const sortedCats = [...(tournament.weightCategories ?? [])]
    // De-dupe per (name, min, max) — API stores one row per gender.
    .reduce<Array<{ name: string; min: number | null; max: number | null }>>((acc, c) => {
      const min = c.minWeight !== null ? Number(c.minWeight) : null;
      const max = c.maxWeight !== null ? Number(c.maxWeight) : null;
      if (!acc.some((x) => x.name === c.name && x.min === min && x.max === max)) {
        acc.push({ name: c.name, min, max });
      }
      return acc;
    }, [])
    .sort((a, b) => (a.max ?? Infinity) - (b.max ?? Infinity));
  const kg = t('kg_suffix');
  const categoriesLabel = sortedCats.length === 0
    ? t('setup_none')
    : sortedCats
        .map((c) => {
          if (c.max === null && c.min === null) return c.name;
          if (c.max === null) return `${c.min}+ ${kg}`;
          return `−${c.max} ${kg}`;
        })
        .join(', ');

  const fee = sc.entryFee;
  const feeLabel = !fee || fee.type === 'free'
    ? t('setup_entry_fee_free')
    : `${fee.amount ?? '—'}${fee.description ? ` · ${fee.description}` : ''}`;

  const PRIZE_ICONS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

  // Sort: unscoped (general) → age-only → age+weight → most specific. Within
  // the same scope-tier, by age group then place. Gives a "general at top,
  // overrides below" order without explicit section headers.
  const sortedPrizes = [...(sc.prizes ?? [])].sort((a, b) => {
    const aScope = (a.ageGroup ? 1 : 0) + (a.weightCategoryId ? 2 : 0);
    const bScope = (b.ageGroup ? 1 : 0) + (b.weightCategoryId ? 2 : 0);
    if (aScope !== bScope) return aScope - bScope;
    const aAge = a.ageGroup ?? '';
    const bAge = b.ageGroup ?? '';
    if (aAge !== bAge) return aAge.localeCompare(bAge);
    return a.place - b.place;
  });

  function formatPrizeAmount(p: { type: string; amount?: string | number; description?: string }): {
    text: string;
    isMoney: boolean;
  } {
    if (p.type === 'money' && p.amount != null) {
      const n = typeof p.amount === 'number' ? p.amount : parseFloat(p.amount);
      const formatted = Number.isFinite(n) ? n.toLocaleString() : String(p.amount);
      return { text: formatted, isMoney: true };
    }
    return { text: p.description?.trim() || p.type, isMoney: false };
  }

  /**
   * Resolve a prize's `weightCategoryId` to the API category's name.
   *
   * The wizard stores it as its client-side id (`c1`, `c2`, ...) in the
   * `sportConfig.prizes` JSONB. The API saves the actual `weight_categories`
   * rows with new UUIDs, but with `sortOrder` matching the wizard's array
   * index. So we recover the link via `c<N>` → `sortOrder = N - 1`.
   *
   * Falls back to a direct UUID match (covers future-proofing if the wizard
   * is reworked to store API ids) and to `null` if nothing matches.
   */
  function resolveWeightCategoryName(wcId: string | undefined): string | null {
    if (!wcId) return null;
    const cats = tournament.weightCategories ?? [];
    const direct = cats.find((c) => c.id === wcId);
    if (direct) return direct.name;
    const m = wcId.match(/^c(\d+)$/);
    if (m) {
      const sortOrder = parseInt(m[1], 10) - 1;
      const byOrder = cats.find((c) => c.sortOrder === sortOrder);
      if (byOrder) return byOrder.name;
    }
    return null;
  }

  /**
   * "70" → "−70 kg" (a max-weight class), "100+" → "100+ kg" (open class),
   * "Absolute" → "Absolute" (named class). The wizard stores plain numbers
   * for the standard case so we have to infer the meaning from shape. The
   * "kg" suffix comes from `t('kg_suffix')` (closure variable above) so the
   * locale shows "кг" in Russian.
   */
  function formatCategoryName(name: string): string {
    if (/^\d+(\.\d+)?\+$/.test(name)) return `${name} ${kg}`;
    if (/^\d+(\.\d+)?$/.test(name)) return `−${name} ${kg}`;
    return name;
  }

  const descKey = `description${descriptionLocale.charAt(0).toUpperCase()}${descriptionLocale.slice(1)}` as
    | 'descriptionRu'
    | 'descriptionEn'
    | 'descriptionHy';
  const descText = (tournament[descKey] as string | null) ?? '';

  return (
    <Section title={t('setup_title')}>
      <dl className="grid grid-cols-1 sm:grid-cols-[max-content_1fr] gap-x-6 gap-y-3 text-sm">
        <SetupRow label={t('setup_age_groups')}>{ageLabel}</SetupRow>
        <SetupRow label={t('setup_categories')}>{categoriesLabel}</SetupRow>
        <SetupRow label={t('setup_genders')}>{genderLabel}</SetupRow>
        <SetupRow label={t('setup_hand')}>{handLabel}</SetupRow>
        <SetupRow label={t('setup_entry_fee')}>{feeLabel}</SetupRow>
        <SetupRow label={t('setup_prizes')}>
          {sortedPrizes.length === 0 ? (
            <span className="text-[var(--color-text-muted)]">{t('setup_prizes_none')}</span>
          ) : (
            <ul className="flex flex-col gap-1">
              {sortedPrizes.map((p, i) => {
                const amount = formatPrizeAmount(p);
                const ageLabel = p.ageGroup
                  ? t(`setup_age_${p.ageGroup}` as any, { defaultValue: p.ageGroup })
                  : null;
                const wcRaw = resolveWeightCategoryName(p.weightCategoryId);
                const wcLabel = wcRaw ? formatCategoryName(wcRaw) : null;
                const scopeBits = [ageLabel, wcLabel].filter(Boolean) as string[];
                return (
                  <li key={i} className="flex items-baseline gap-2 flex-wrap text-sm">
                    <span className="text-base leading-none" aria-hidden>
                      {PRIZE_ICONS[p.place] ?? `${p.place}.`}
                    </span>
                    <span className="font-bold text-[var(--color-text-primary)] tabular-nums">
                      {t('setup_prize_place', { n: p.place })}
                    </span>
                    <span
                      className={
                        amount.isMoney
                          ? 'font-semibold text-[var(--color-accent)] tabular-nums'
                          : 'text-[var(--color-text-primary)]'
                      }
                    >
                      {amount.text}
                    </span>
                    {scopeBits.length > 0 && (
                      <span className="text-xs text-[var(--color-text-muted)]">
                        — {scopeBits.join(' · ')}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </SetupRow>
        {tournament.streamUrl && (
          <SetupRow label={t('setup_stream')}>
            <a
              href={tournament.streamUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] underline truncate inline-block max-w-full"
            >
              {tournament.streamUrl}
            </a>
          </SetupRow>
        )}
        <SetupRow label={t('setup_featured')}>
          <button
            type="button"
            onClick={onToggleFeatured}
            disabled={toggleFeaturedPending}
            className={[
              'inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50',
              tournament.isFeatured
                ? 'border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)] hover:bg-[var(--color-accent)]/15'
                : 'border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)]',
            ].join(' ')}
            aria-pressed={tournament.isFeatured}
          >
            <span aria-hidden className="text-sm leading-none">
              {tournament.isFeatured ? '★' : '☆'}
            </span>
            <span>
              {tournament.isFeatured ? t('setup_featured_on') : t('setup_featured_off')}
            </span>
          </button>
        </SetupRow>
      </dl>

      {/* Description — collapsible with locale tabs */}
      <div className="mt-5 pt-5 border-t border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setShowDescription(!showDescription)}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <span aria-hidden>{showDescription ? '▾' : '▸'}</span>
          <span>{showDescription ? t('setup_hide_description') : t('setup_show_description')}</span>
        </button>
        {showDescription && (
          <div className="mt-3 space-y-3">
            <div className="flex gap-1">
              {(['ru', 'en', 'hy'] as const).map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => setDescriptionLocale(loc)}
                  className={[
                    'px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border transition-colors',
                    descriptionLocale === loc
                      ? 'border-[var(--color-primary)] bg-[var(--color-primary-dim)] text-[var(--color-primary)]'
                      : 'border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]',
                  ].join(' ')}
                >
                  {loc}
                </button>
              ))}
            </div>
            <div className="rounded-md bg-[var(--color-surface-2)] border border-[var(--color-border)] p-4 text-sm leading-relaxed text-[var(--color-text-primary)]">
              {descText.trim().length > 0 ? (
                <div className="whitespace-pre-wrap">{descText}</div>
              ) : (
                <span className="text-[var(--color-text-muted)]">{t('setup_description_empty')}</span>
              )}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

function SetupRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--color-text-muted)] sm:pt-1">
        {label}
      </dt>
      <dd className="text-[var(--color-text-primary)] min-w-0">{children}</dd>
    </>
  );
}

// ─── Danger zone — cancel + delete ───────────────────────────

function DangerZone({
  canDelete,
  canCancel,
  showCancelConfirm,
  setShowCancelConfirm,
  showDeleteConfirm,
  setShowDeleteConfirm,
  cancelPending,
  deletePending,
  onCancel,
  onDelete,
  cancelError,
  deleteError,
  t,
}: {
  canDelete: boolean;
  canCancel: boolean;
  showCancelConfirm: boolean;
  setShowCancelConfirm: (v: boolean) => void;
  showDeleteConfirm: boolean;
  setShowDeleteConfirm: (v: boolean) => void;
  cancelPending: boolean;
  deletePending: boolean;
  onCancel: () => void;
  onDelete: () => void;
  cancelError?: string;
  deleteError?: string;
  t: ReturnType<typeof useTranslations>;
}) {
  // Hide the whole zone once both terminal actions are unavailable — there's
  // nothing to do here, no point showing two greyed-out buttons.
  if (!canCancel && !canDelete) return null;

  return (
    <div className="rounded-xl border border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-4 sm:p-6">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[var(--color-error)] mb-4">
        ⚠ {t('danger_zone_title')}
      </h2>
      <div className="space-y-4">
        {canCancel && (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t('cancel_tournament')}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {t('cancel_tournament_help')}
              </p>
            </div>
            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="px-4 py-2 rounded-md text-sm font-bold border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/15 transition-colors"
              >
                {t('cancel_tournament')}
              </button>
            ) : (
              <div className="w-full p-3 rounded-md bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/40 space-y-3">
                <p className="text-sm text-[var(--color-text-primary)]">{t('cancel_tournament_confirm')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={onCancel}
                    disabled={cancelPending}
                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-[var(--color-warning)]/20 text-[var(--color-warning)] hover:bg-[var(--color-warning)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {cancelPending ? t('saving') : t('cancel_tournament')}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    className="px-3 py-1.5 rounded-md text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    {t('cancel')}
                  </button>
                </div>
                {cancelError && (
                  <p className="text-xs text-[var(--color-error)]">{cancelError}</p>
                )}
              </div>
            )}
          </div>
        )}

        {canDelete && (
          <div className="flex items-start justify-between gap-4 flex-wrap pt-4 border-t border-[var(--color-error)]/20">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">
                {t('delete_tournament')}
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                {t('delete_tournament_help')}
              </p>
            </div>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 rounded-md text-sm font-bold border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 text-[var(--color-error)] hover:bg-[var(--color-error)]/15 transition-colors"
              >
                {t('delete_tournament')}
              </button>
            ) : (
              <div className="w-full p-3 rounded-md bg-[var(--color-error)]/10 border border-[var(--color-error)]/40 space-y-3">
                <p className="text-sm text-[var(--color-text-primary)]">{t('delete_tournament_confirm')}</p>
                <div className="flex gap-2">
                  <button
                    onClick={onDelete}
                    disabled={deletePending}
                    className="px-3 py-1.5 rounded-md text-xs font-bold bg-[var(--color-error)]/20 text-[var(--color-error)] hover:bg-[var(--color-error)]/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deletePending ? t('saving') : t('delete_tournament')}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 rounded-md text-xs text-[var(--color-text-secondary)] border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
                  >
                    {t('cancel')}
                  </button>
                </div>
                {deleteError && (
                  <p className="text-xs text-[var(--color-error)]">{deleteError}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
