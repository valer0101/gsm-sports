'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useRegister } from '@/hooks/useTournaments';
import type { AgeGroup, Tournament } from '@/types/api';

interface Props {
  tournament: Tournament;
  onClose: () => void;
  onSuccess: () => void;
}

type Step = 'age_group' | 'hand' | 'weight';
type HandChoice = 'left' | 'right' | 'both';
type SelectedWeight = { categoryId: string; weightKg: number; name: string };

const PRIZE_EMOJI: Record<string, string> = {
  money: '💰',
  medal: '🥇',
  trophy: '🏆',
  certificate: '📜',
  custom: '🎁',
};

// Labels resolved via i18n inside the component

export function RegisterModal({ tournament, onClose, onSuccess }: Props) {
  const t = useTranslations('tournaments');
  const tm = useTranslations('register_modal');
  const router = useRouter();

  const [step, setStep] = useState<Step>('age_group');
  const [ageGroup, setAgeGroup] = useState<AgeGroup | null>(null);
  const [hand, setHand] = useState<HandChoice | null>(null);
  const [selectedWeight, setSelectedWeight] = useState<SelectedWeight | null>(null);

  const { mutate, mutateAsync, isPending, error } = useRegister(tournament.id);

  const cfg = (tournament.sportConfig ?? {}) as Record<string, any>;
  const configuredAgeGroups: string[] = cfg.ageGroups ?? [];

  // Hand selection is driven by the SPORT's config (hasHands), not the per-
  // tournament config — armwrestling always has hands; football never does.
  // The per-tournament `hands` still narrows which hands are offered at this
  // specific event (e.g. a right-arm-only tournament).
  const sportHasHands = tournament.sport?.config?.hasHands ?? true;
  const configuredHands: string[] = sportHasHands
    ? (cfg.hands ?? ['right', 'left'])
    : [];

  // Weight categories only matter for weight-class sports.
  const usesWeightCategories = (tournament.sport?.config?.categoriesType ?? 'weight') === 'weight';

  const prizes: any[] = cfg.prizes ?? [];
  const entryFee = cfg.entryFee;

  const ageGroupLabelMap: Record<string, string> = {
    juniors: tm('age_juniors'),
    adults: tm('age_adults'),
    veterans: tm('age_veterans'),
  };

  const ageGroupOptions =
    configuredAgeGroups.length > 0
      ? configuredAgeGroups.map((v) => ({ value: v, label: ageGroupLabelMap[v] ?? v }))
      : [
          { value: 'juniors', label: tm('age_juniors') },
          { value: 'adults', label: tm('age_adults') },
          { value: 'veterans', label: tm('age_veterans') },
        ];

  // Hand options — add "both" if both hands are configured
  const hasRight = configuredHands.includes('right');
  const hasLeft = configuredHands.includes('left');
  const handOptions: { value: HandChoice; label: string; emoji: string }[] = [
    ...(hasRight ? [{ value: 'right' as HandChoice, label: tm('hand_right'), emoji: '🤜' }] : []),
    ...(hasLeft ? [{ value: 'left' as HandChoice, label: tm('hand_left'), emoji: '🤛' }] : []),
    ...(hasRight && hasLeft
      ? [{ value: 'both' as HandChoice, label: tm('hand_both'), emoji: '🤜🤛' }]
      : []),
  ];

  // Sorted weight categories
  const weightCategories = [...(tournament.weightCategories ?? [])].sort(
    (a, b) => (a.maxWeight ?? 9999) - (b.maxWeight ?? 9999),
  );

  const onErr = (err: any) => {
    if (err?.response?.status === 401) {
      router.push(`/auth/login?redirect=${window.location.pathname}`);
    }
  };

  // `override` lets callers (e.g. the age-group step for chess-like sports
  // where submit fires in the same click as `setAgeGroup`) pass the chosen
  // value explicitly, avoiding React's stale-state trap — state setters are
  // batched, so reading `ageGroup` in the same handler would still be null.
  async function handleSubmit(override: { ageGroup?: AgeGroup; hand?: HandChoice } = {}) {
    const effectiveAge = override.ageGroup ?? ageGroup;
    const effectiveHand = override.hand ?? hand;
    if (!effectiveAge) return;
    // Weight is required for weight-class sports, but some sports don't use it.
    if (usesWeightCategories && !selectedWeight) return;
    const weightKg = selectedWeight?.weightKg;
    const weightCategoryId = selectedWeight?.categoryId;
    try {
      if (sportHasHands && effectiveHand === 'both') {
        await mutateAsync({ ageGroup: effectiveAge, hand: 'right', weightKg, weightCategoryId });
        await mutateAsync({ ageGroup: effectiveAge, hand: 'left', weightKg, weightCategoryId });
        onSuccess();
        onClose();
      } else {
        const resolvedHand: 'left' | 'right' | undefined = sportHasHands
          ? (effectiveHand as 'left' | 'right' | undefined)
          : undefined;
        mutate(
          {
            ageGroup: effectiveAge,
            hand: resolvedHand,
            weightKg,
            weightCategoryId,
          },
          {
            onSuccess: () => {
              onSuccess();
              onClose();
            },
            onError: onErr,
          },
        );
      }
    } catch (err) {
      onErr(err);
    }
  }

  // Dynamic step flow — only include steps relevant to this sport config.
  const steps: Step[] = [
    'age_group',
    ...(sportHasHands ? (['hand'] as Step[]) : []),
    ...(usesWeightCategories ? (['weight'] as Step[]) : []),
  ];
  // Snap forward if the stored step isn't in the active list (e.g. hand step
  // selected but sport has no hands).
  const activeStep: Step = steps.includes(step) ? step : steps[0];
  const stepIdx = steps.indexOf(activeStep);
  const prevStep = stepIdx > 0 ? steps[stepIdx - 1] : null;
  const nextStep = stepIdx >= 0 && stepIdx < steps.length - 1 ? steps[stepIdx + 1] : null;
  const isLastStep = stepIdx === steps.length - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)' }}
    >
      <div
        className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-white/10 overflow-hidden"
        style={{ backgroundColor: 'var(--color-secondary)', maxHeight: '95vh', overflowY: 'auto' }}
      >
        {/* ─── Tournament Banner ─── */}
        <div className="relative h-40 sm:h-48 bg-gradient-to-br from-white/5 to-white/10 flex-shrink-0">
          {tournament.posterUrl ? (
            <Image
              src={tournament.posterUrl}
              alt={tournament.name}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-5xl opacity-30">🏆</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 text-sm"
          >
            ✕
          </button>
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <h2 className="text-lg font-black text-white leading-tight">{tournament.name}</h2>
            <div
              className="flex flex-wrap gap-3 mt-1 text-xs"
              style={{ color: 'rgba(255,255,255,0.7)' }}
            >
              {tournament.location && <span>📍 {tournament.location}</span>}
              {tournament.startDate && (
                <span>
                  📅{' '}
                  {new Date(tournament.startDate).toLocaleDateString('ru-RU', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-5">
          {/* ─── Info chips ─── */}
          <div className="flex flex-wrap gap-2 mb-4">
            {configuredAgeGroups.length > 0 && (
              <span
                className="text-xs px-2.5 py-1 rounded-full bg-white/8 border border-white/10"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                👤 {configuredAgeGroups.map((a) => ageGroupLabelMap[a] ?? a).join(', ')}
              </span>
            )}
            {(hasRight || hasLeft) && (
              <span
                className="text-xs px-2.5 py-1 rounded-full bg-white/8 border border-white/10"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {hasRight && hasLeft ? tm('hand_both_chip') : hasRight ? tm('hand_right_chip') : tm('hand_left_chip')}
              </span>
            )}
            {entryFee && (
              <span
                className="text-xs px-2.5 py-1 rounded-full bg-white/8 border border-white/10"
                style={{
                  color: entryFee.type === 'free' ? '#86efac' : 'var(--color-text-secondary)',
                }}
              >
                {entryFee.type === 'free'
                  ? tm('entry_free')
                  : entryFee.amount
                    ? tm('entry_paid', { amount: entryFee.amount.toLocaleString() })
                    : tm('entry_paid_no_amount')}
              </span>
            )}
          </div>

          {/* ─── Prizes ─── */}
          {prizes.length > 0 && (
            <div className="mb-5 p-3 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
              <p className="text-xs font-semibold text-yellow-300 uppercase tracking-wider mb-2">
                {tm('prizes_title')}
              </p>
              <div className="space-y-1.5">
                {prizes.map((prize, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <span className="w-6 text-center font-bold text-yellow-400">{prize.place}</span>
                    <span>{PRIZE_EMOJI[prize.type] ?? '🎁'}</span>
                    <span className="text-white">
                      {prize.type === 'money' && prize.value
                        ? `${Number(prize.value).toLocaleString()} AMD`
                        : prize.description || prize.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ─── Step indicator ─── */}
          <div className="flex gap-1.5 mb-5">
            {steps.map((s, i) => (
              <div
                key={s}
                className="flex-1 h-1 rounded-full transition-colors"
                style={{
                  backgroundColor: i <= stepIdx ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                }}
              />
            ))}
          </div>

          {/* ─── Step 1: Age Group ─── */}
          {activeStep === 'age_group' && (
            <div>
              <p className="font-semibold text-white mb-3">{t('select_age_group')}</p>
              <div className="space-y-2">
                {ageGroupOptions.map((ag) => (
                  <button
                    key={ag.value}
                    onClick={() => {
                      const picked = ag.value as AgeGroup;
                      setAgeGroup(picked);
                      if (nextStep) setStep(nextStep);
                      else handleSubmit({ ageGroup: picked });
                    }}
                    className="w-full text-left px-4 py-3 rounded-xl border transition-colors"
                    style={{
                      borderColor:
                        ageGroup === ag.value ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                      backgroundColor:
                        ageGroup === ag.value ? 'rgba(255,255,255,0.05)' : 'transparent',
                      color: 'white',
                    }}
                  >
                    <span className="font-medium">{ag.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ─── Step 2: Hand ─── */}
          {activeStep === 'hand' && (
            <div>
              <p className="font-semibold text-white mb-3">{t('select_hand')}</p>
              <div
                className={`grid gap-3 ${
                  handOptions.length === 1
                    ? 'grid-cols-1'
                    : handOptions.length === 2
                      ? 'grid-cols-2'
                      : 'grid-cols-3'
                }`}
              >
                {handOptions.map((h) => (
                  <button
                    key={h.value}
                    onClick={() => {
                      setHand(h.value);
                      if (nextStep) setStep(nextStep);
                    }}
                    className="px-4 py-5 rounded-xl border flex flex-col items-center gap-2 transition-colors"
                    style={{
                      borderColor:
                        hand === h.value ? 'var(--color-accent)' : 'rgba(255,255,255,0.1)',
                      backgroundColor: hand === h.value ? 'rgba(255,255,255,0.05)' : 'transparent',
                      color: 'white',
                    }}
                  >
                    <span className="text-2xl">{h.emoji}</span>
                    <span className="font-medium text-sm">{h.label}</span>
                    {h.value === 'both' && (
                      <span className="text-xs opacity-50">{tm('hand_both_note')}</span>
                    )}
                  </button>
                ))}
              </div>
              {prevStep && (
                <button
                  onClick={() => setStep(prevStep)}
                  className="mt-3 text-sm hover:text-white transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {tm('back')}
                </button>
              )}
            </div>
          )}

          {/* ─── Step 3: Weight ─── */}
          {activeStep === 'weight' && (
            <div>
              <p className="font-semibold text-white mb-1">{tm('select_weight')}</p>
              <p className="text-xs mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                {tm('select_weight_desc')}
              </p>

              {/* Weight category buttons */}
              {weightCategories.length > 0 ? (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {weightCategories.map((wc) => {
                    const isSelected = selectedWeight?.categoryId === wc.id;
                    const weightKg = wc.maxWeight ?? wc.minWeight ?? 0;
                    const tol = Number(wc.weightToleranceKg ?? 0);
                    return (
                      <button
                        key={wc.id}
                        onClick={() =>
                          setSelectedWeight({ categoryId: wc.id, weightKg, name: wc.name })
                        }
                        className="py-4 rounded-xl border flex flex-col items-center gap-1 transition-all"
                        style={{
                          borderColor: isSelected
                            ? 'var(--color-accent)'
                            : 'rgba(255,255,255,0.12)',
                          backgroundColor: isSelected
                            ? 'rgba(255,200,0,0.12)'
                            : 'rgba(255,255,255,0.02)',
                          color: isSelected ? 'var(--color-accent)' : 'white',
                        }}
                      >
                        <span className="text-lg font-black">{weightKg}</span>
                        <span className="text-xs opacity-60">{tm('kg')}</span>
                        {tol > 0 && (
                          <span className="text-[10px] opacity-60">+{tol} {tm('kg')}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
                  {tm('no_weight_categories')}
                </p>
              )}

              {/* Summary */}
              <div
                className="rounded-xl p-3 mb-3 text-sm space-y-1.5"
                style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}
              >
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>{tm('summary_age')}</span>
                  <span className="text-white font-medium">
                    {ageGroup ? (ageGroupLabelMap[ageGroup] ?? ageGroup) : '—'}
                  </span>
                </div>
                {sportHasHands && (
                  <div className="flex justify-between">
                    <span style={{ color: 'var(--color-text-secondary)' }}>{tm('summary_hand')}</span>
                    <span className="text-white font-medium">
                      {hand === 'right'
                        ? tm('hand_right_summary')
                        : hand === 'left'
                          ? tm('hand_left_summary')
                          : hand === 'both'
                            ? tm('hand_both_summary')
                            : '—'}
                    </span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span style={{ color: 'var(--color-text-secondary)' }}>{tm('summary_category')}</span>
                  <span
                    className="font-semibold"
                    style={{
                      color: selectedWeight ? 'var(--color-accent)' : 'rgba(255,255,255,0.3)',
                    }}
                  >
                    {selectedWeight ? selectedWeight.name : '—'}
                  </span>
                </div>
              </div>

              {error && (
                <p className="mb-3 text-xs text-red-400">
                  {(error as any)?.response?.data?.message ?? t('register_error')}
                </p>
              )}

              <button
                onClick={() => handleSubmit()}
                disabled={isPending || (usesWeightCategories && !selectedWeight)}
                className="w-full py-3 rounded-xl font-bold transition-opacity disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
              >
                {isPending
                  ? t('registering')
                  : hand === 'both'
                    ? tm('register_both')
                    : t('confirm_register')}
              </button>

              {prevStep && (
                <button
                  onClick={() => setStep(prevStep)}
                  className="mt-3 w-full text-sm hover:text-white transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {tm('back')}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
