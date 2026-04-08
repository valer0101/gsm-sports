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
} from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/Skeleton';

export default function AdminTournamentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('admin_tournament');
  const tAdmin = useTranslations('admin');
  const { data: tournament, isLoading } = useAdminTournament(id);
  const toggleReg = useToggleRegistration(id);
  const generateBrackets = useGenerateBrackets(id);
  const { data: operators } = useAdminOperators(id);
  const assignOp = useAssignOperator(id);
  const removeOp = useRemoveOperator(id);

  const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);
  const [operatorEmail, setOperatorEmail] = useState('');
  const [assignError, setAssignError] = useState('');

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
      onError: (err: any) =>
        setAssignError(err?.response?.data?.message ?? t('assign_error')),
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
            value={tournament.registrationOpen ? t('stat_registration_open') : t('stat_registration_closed')}
          />
          <Stat
            label={t('stat_bracket')}
            value={tournament.bracketGenerated ? t('stat_bracket_ready') : t('stat_bracket_pending')}
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
                {t('generated_count', { count: (generateBrackets.data as any)?.bracketsCreated ?? 0 })}
              </p>
            )}
            {generateBrackets.error && (
              <p className="mt-2 text-red-400 text-sm">
                {(generateBrackets.error as any)?.response?.data?.message ?? 'Ошибка'}
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
