'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import type { BracketMatch, MatchResult, MatchResultSchema } from '@/types/api';

/**
 * Schema-driven result-entry form (Phase 3.2). One component for all
 * sports — switches on `schema` to render the right fields and returns a
 * validated `MatchResult` (or `null`) via `onChange`. The parent owns the
 * "Confirm" button; this component just keeps the payload in sync with
 * user input.
 *
 * The form is intentionally minimal — just the fields the backend
 * validator enforces. Optional fields (armwrestling rounds, notes) are
 * tucked behind a "more details" toggle so the 90% case (pin win, simple
 * score) stays one or two clicks.
 */
export function MatchResultForm({
  schema,
  match,
  onChange,
}: {
  schema: MatchResultSchema;
  match: BracketMatch;
  /** Fires whenever the payload changes. `null` = clear, `undefined` = no explicit payload (keep prior). */
  onChange: (result: MatchResult | null | undefined) => void;
}) {
  const t = useTranslations('match_result');
  // `simple_winner` sports don't need any input at all — short-circuit
  // so the parent can render nothing and jump straight to Confirm.
  if (schema === 'simple_winner') {
    return null;
  }

  switch (schema) {
    case 'armwrestling':
      return <ArmwrestlingFields match={match} onChange={onChange} />;
    case 'points':
      return <PointsFields match={match} onChange={onChange} />;
    case 'score':
      return <ScoreFields match={match} onChange={onChange} />;
    case 'time':
      return <TimeFields match={match} onChange={onChange} />;
    case 'armfight_bo5':
      // Armfight bouts are scored leg-by-leg via the dedicated
      // POST /v1/brackets/:id/legs endpoint, not through the generic
      // /result form. The selectWinner path on the engine throws for
      // armfight brackets, so this form should never be reached for an
      // armfight match — but if it is (e.g. an admin opens an armfight
      // match in the legacy result modal), render nothing instead of a
      // mis-applied schema input.
      return null;
    default: {
      const _exhaustive: never = schema;
      // Defensive UI for the case where a new `MatchResultSchema` is
      // added in shared-types but not wired into this form. The TS
      // `never` assignment fails the build first, so end users should
      // never see this — but if they do, the message is i18n'd so it
      // doesn't break the locale UI.
      return (
        <p className="text-xs text-red-400">
          {t('unsupported_schema', { schema: String(_exhaustive) })}
        </p>
      );
    }
  }
}

// ─── Armwrestling ─────────────────────────────────────────────

function ArmwrestlingFields({
  match,
  onChange,
}: {
  match: BracketMatch;
  onChange: (result: MatchResult | null | undefined) => void;
}) {
  const t = useTranslations('match_result');
  const [victoryType, setVictoryType] = useState<'pin' | 'points' | 'fouls' | 'dq'>('pin');
  const [p1Fouls, setP1Fouls] = useState('');
  const [p2Fouls, setP2Fouls] = useState('');

  // Debounced onChange — when any field changes, build + emit the payload.
  const emit = (next: {
    victoryType?: 'pin' | 'points' | 'fouls' | 'dq';
    p1Fouls?: string;
    p2Fouls?: string;
  }) => {
    const vt = next.victoryType ?? victoryType;
    const f1 = parsePositiveInt(next.p1Fouls ?? p1Fouls);
    const f2 = parsePositiveInt(next.p2Fouls ?? p2Fouls);

    const result: Record<string, unknown> = {
      schema: 'armwrestling',
      victoryType: vt,
    };
    const fouls: Record<string, number> = {};
    if (f1 !== null) fouls[match.player1.id] = f1;
    if (f2 !== null) fouls[match.player2.id] = f2;
    if (Object.keys(fouls).length > 0) result.fouls = fouls;

    onChange(result as unknown as MatchResult);
  };

  const options: Array<{ value: 'pin' | 'points' | 'fouls' | 'dq'; label: string }> = [
    { value: 'pin', label: t('aw_pin') },
    { value: 'points', label: t('aw_points') },
    { value: 'fouls', label: t('aw_fouls') },
    { value: 'dq', label: t('aw_dq') },
  ];

  return (
    <div className="space-y-3 mt-3 px-4 pb-4">
      <Field label={t('aw_victory_type')}>
        <div className="grid grid-cols-4 gap-1.5">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                setVictoryType(o.value);
                emit({ victoryType: o.value });
              }}
              className="px-2 py-1.5 rounded-lg text-xs font-bold border transition-colors"
              style={{
                borderColor:
                  victoryType === o.value ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                color:
                  victoryType === o.value ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                backgroundColor:
                  victoryType === o.value ? 'var(--color-accent-dim)' : 'transparent',
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Field>

      {/* Fouls: only relevant when victory is by fouls or DQ. Always shown
          but optional so operators can skip in common pin/points cases. */}
      <div className="grid grid-cols-2 gap-2">
        <Field label={`${t('aw_fouls_short')} · ${short(match.player1.firstName)}`}>
          <NumberInput
            value={p1Fouls}
            onChange={(v) => {
              setP1Fouls(v);
              emit({ p1Fouls: v });
            }}
            placeholder="0"
          />
        </Field>
        <Field label={`${t('aw_fouls_short')} · ${short(match.player2.firstName)}`}>
          <NumberInput
            value={p2Fouls}
            onChange={(v) => {
              setP2Fouls(v);
              emit({ p2Fouls: v });
            }}
            placeholder="0"
          />
        </Field>
      </div>

      {/* Fire initial onChange so the parent has the default `{schema, victoryType: 'pin'}` even if the user doesn't touch anything. */}
      <Mount onMount={() => emit({})} />
    </div>
  );
}

// ─── Points (judge cards — single-card MVP) ───────────────────

function PointsFields({
  match,
  onChange,
}: {
  match: BracketMatch;
  onChange: (result: MatchResult | null | undefined) => void;
}) {
  const t = useTranslations('match_result');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');

  const emit = (n1: string, n2: string) => {
    const v1 = parsePositiveInt(n1);
    const v2 = parsePositiveInt(n2);
    if (v1 === null || v2 === null) {
      onChange(undefined);
      return;
    }
    onChange({
      schema: 'points',
      cards: [{ player1: v1, player2: v2 }],
    });
  };

  return (
    <div className="space-y-3 mt-3 px-4 pb-4">
      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {t('points_hint')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label={short(match.player1.firstName)}>
          <NumberInput
            value={p1}
            onChange={(v) => {
              setP1(v);
              emit(v, p2);
            }}
            placeholder="29"
          />
        </Field>
        <Field label={short(match.player2.firstName)}>
          <NumberInput
            value={p2}
            onChange={(v) => {
              setP2(v);
              emit(p1, v);
            }}
            placeholder="28"
          />
        </Field>
      </div>
    </div>
  );
}

// ─── Score (single-period MVP) ────────────────────────────────

function ScoreFields({
  match,
  onChange,
}: {
  match: BracketMatch;
  onChange: (result: MatchResult | null | undefined) => void;
}) {
  const t = useTranslations('match_result');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');

  const emit = (n1: string, n2: string) => {
    const v1 = parsePositiveInt(n1);
    const v2 = parsePositiveInt(n2);
    if (v1 === null || v2 === null) {
      onChange(undefined);
      return;
    }
    onChange({
      schema: 'score',
      periods: [{ player1: v1, player2: v2 }],
      finalPlayer1: v1,
      finalPlayer2: v2,
    });
  };

  return (
    <div className="space-y-3 mt-3 px-4 pb-4">
      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {t('score_hint')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label={short(match.player1.firstName)}>
          <NumberInput
            value={p1}
            onChange={(v) => {
              setP1(v);
              emit(v, p2);
            }}
          />
        </Field>
        <Field label={short(match.player2.firstName)}>
          <NumberInput
            value={p2}
            onChange={(v) => {
              setP2(v);
              emit(p1, v);
            }}
          />
        </Field>
      </div>
    </div>
  );
}

// ─── Time ─────────────────────────────────────────────────────

function TimeFields({
  match,
  onChange,
}: {
  match: BracketMatch;
  onChange: (result: MatchResult | null | undefined) => void;
}) {
  const t = useTranslations('match_result');
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');

  const emit = (n1: string, n2: string) => {
    const ms1 = parseSecondsToMs(n1);
    const ms2 = parseSecondsToMs(n2);
    if (ms1 === null || ms2 === null) {
      onChange(undefined);
      return;
    }
    onChange({ schema: 'time', player1Ms: ms1, player2Ms: ms2 });
  };

  return (
    <div className="space-y-3 mt-3 px-4 pb-4">
      <p className="text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {t('time_hint')}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Field label={`${short(match.player1.firstName)} · ${t('time_seconds_label')}`}>
          <NumberInput
            value={p1}
            onChange={(v) => {
              setP1(v);
              emit(v, p2);
            }}
            step="0.01"
            placeholder="48.30"
          />
        </Field>
        <Field label={`${short(match.player2.firstName)} · ${t('time_seconds_label')}`}>
          <NumberInput
            value={p2}
            onChange={(v) => {
              setP2(v);
              emit(p1, v);
            }}
            step="0.01"
            placeholder="49.10"
          />
        </Field>
      </div>
    </div>
  );
}

// ─── Internals ────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span
        className="block text-[10px] font-bold uppercase tracking-wider mb-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  placeholder,
  step,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <input
      type="number"
      min="0"
      step={step ?? '1'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? ''}
      className="w-full px-3 py-2 rounded-lg bg-transparent border border-white/10 text-white text-sm outline-none focus:border-[var(--color-accent)] transition-colors"
    />
  );
}

/** Tiny helper — calls `onMount` once on first render. Saves writing a
 *  useEffect at every caller site for the common "emit defaults" pattern. */
function Mount({ onMount }: { onMount: () => void }) {
  useEffect(() => {
    onMount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

function parsePositiveInt(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

function parseSecondsToMs(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 1000);
}

/** Truncate a first name for the compact two-column field label. */
function short(name: string): string {
  return name.length > 12 ? `${name.slice(0, 11)}…` : name;
}
