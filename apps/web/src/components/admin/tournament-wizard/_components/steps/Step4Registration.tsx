'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../../_lib/icons';
import { type AgeGroup, type CompetitionType, type Prize, type EntryFeeType, type ReviewData, type WeightCat, categoryLabel, newPrizeId } from '../../_lib/types';
import { AGE_GROUPS } from '../../_lib/constants';
import { sumMoney, totalTournamentPayout, bracketsPerPair } from '../../_lib/prize-calc';
import { Section, SectionTitle, Label, Helper } from '../fields/Section';
import { Toggle } from '../fields/Toggle';
import { DateTimeInput } from '../fields/DateTimeInput';
import { PlaceGroup } from '../PlaceGroup';
import { ReviewBlock } from '../ReviewBlock';

export type Step4Props = {
  registrationDeadline: string; setRegistrationDeadline: (v: string) => void;
  registrationOpenImmediately: boolean; setRegistrationOpenImmediately: (v: boolean) => void;
  entryFeeType: EntryFeeType; setEntryFeeType: (v: EntryFeeType) => void;
  entryFeeAmount: string; setEntryFeeAmount: (v: string) => void;
  entryFeeConditions: string; setEntryFeeConditions: (v: string) => void;
  prizes: Prize[]; setPrizes: (v: Prize[]) => void;
  streamUrl: string; setStreamUrl: (v: string) => void;
  isFeatured: boolean; setIsFeatured: (v: boolean) => void;
  /** Picked in Step 2 — the main-event toggle & video link are armfight-only. */
  competitionType: CompetitionType;
  armfightVideoUrl: string; setArmfightVideoUrl: (v: string) => void;
  maxParticipants: string; setMaxParticipants: (v: string) => void;
  /** Picked in Step 2 — drives the per-age-group prize tabs. */
  ageGroups: Set<AgeGroup>;
  /** Picked in Step 3 — drives the per-category prize tabs. */
  categories: WeightCat[];
  /** 2 if both hands, else 1 — feeds the bracket-multiplier total. */
  handMul: number;
  /** Number of genders competing (Step 3) — 1 or 2. */
  genderCount: number;
  review: ReviewData;
  goToStep: (n: number) => void;
};

export function Step4Registration(p: Step4Props) {
  const t = useTranslations('tournament_wizard');
  const ta = useTranslations('armfight');
  const isArmfight = p.competitionType === 'armfight';

  const ageLabelLower = (id: AgeGroup): string =>
    id === 'juniors' ? t('age_juniors').toLowerCase()
    : id === 'adults' ? t('age_adults').toLowerCase()
    : t('age_veterans').toLowerCase();
  const ageLabel = (id: AgeGroup): string =>
    id === 'juniors' ? t('age_juniors')
    : id === 'adults' ? t('age_adults')
    : t('age_veterans');

  const showAgeTabs = p.ageGroups.size > 1;
  const showCatTabs = p.categories.length > 0;

  const [activeAge, setActiveAge] = useState<AgeGroup | null>(null);
  const [activeCat, setActiveCat] = useState<string | null>(null);

  // Drop stale tab targets if the user went back and removed the option.
  const effectiveAge: AgeGroup | null = activeAge && !p.ageGroups.has(activeAge) ? null : activeAge;
  const effectiveCat: string | null = activeCat && !p.categories.some((c) => c.id === activeCat) ? null : activeCat;

  // Prizes whose scope matches the active tab pair exactly.
  const tabPrizes = useMemo(
    () => p.prizes.filter((pr) =>
      (effectiveAge === null ? !pr.ageGroup : pr.ageGroup === effectiveAge)
      && (effectiveCat === null ? !pr.weightCategoryId : pr.weightCategoryId === effectiveCat),
    ),
    [p.prizes, effectiveAge, effectiveCat],
  );

  const placeGroups = useMemo(() => {
    const m = new Map<number, Prize[]>();
    for (const pr of tabPrizes) {
      if (!m.has(pr.place)) m.set(pr.place, []);
      m.get(pr.place)!.push(pr);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a - b);
  }, [tabPrizes]);

  const perBracketActive = useMemo(() => sumMoney(tabPrizes), [tabPrizes]);

  const tournamentTotal = useMemo(
    () => totalTournamentPayout(p.prizes, p.ageGroups, p.categories, p.handMul, p.genderCount),
    [p.prizes, p.ageGroups, p.categories, p.handMul, p.genderCount],
  );

  const totalBrackets = useMemo(() => {
    const ageCount = Math.max(1, p.ageGroups.size);
    const catCount = Math.max(1, p.categories.length);
    return bracketsPerPair(p.handMul, p.genderCount) * ageCount * catCount;
  }, [p.ageGroups.size, p.categories.length, p.handMul, p.genderCount]);

  const tagForNew = (): { ageGroup?: AgeGroup; weightCategoryId?: string } => ({
    ...(effectiveAge !== null && { ageGroup: effectiveAge }),
    ...(effectiveCat !== null && { weightCategoryId: effectiveCat }),
  });

  const addPlace = () => {
    const nextPlace = tabPrizes.length === 0
      ? 1
      : Math.max(...tabPrizes.map((x) => x.place)) + 1;
    p.setPrizes([
      ...p.prizes,
      { id: newPrizeId(), place: nextPlace, type: 'money', amount: '', ...tagForNew() },
    ]);
  };
  const addRewardToPlace = (place: number) => {
    p.setPrizes([
      ...p.prizes,
      { id: newPrizeId(), place, type: 'medal', description: '', ...tagForNew() },
    ]);
  };
  const updatePrize = (id: string, patch: Partial<Prize>) => {
    p.setPrizes(p.prizes.map((pr) => (pr.id === id ? { ...pr, ...patch } : pr)));
  };
  const removePrize = (id: string) => {
    p.setPrizes(p.prizes.filter((pr) => pr.id !== id));
  };
  const removePlace = (place: number) => {
    p.setPrizes(p.prizes.filter((pr) => {
      const matchesAge = effectiveAge === null ? !pr.ageGroup : pr.ageGroup === effectiveAge;
      const matchesCat = effectiveCat === null ? !pr.weightCategoryId : pr.weightCategoryId === effectiveCat;
      return !(matchesAge && matchesCat && pr.place === place);
    }));
  };

  const ageHasOverrides = (g: AgeGroup) =>
    p.prizes.some((pr) => pr.ageGroup === g);
  const catHasOverridesInActiveAge = (catId: string) =>
    p.prizes.some(
      (pr) => pr.weightCategoryId === catId
        && (effectiveAge === null ? !pr.ageGroup : pr.ageGroup === effectiveAge),
    );

  // Used in the empty-state and override info banner.
  const scopeLabel = useMemo(() => {
    const parts: string[] = [];
    if (effectiveAge) parts.push(ageLabelLower(effectiveAge));
    if (effectiveCat) {
      const cat = p.categories.find((c) => c.id === effectiveCat);
      if (cat) parts.push(categoryLabel(cat));
    }
    return parts.join(' · ');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ageLabelLower closes over `t` which is stable per locale; recomputing on each render is fine.
  }, [effectiveAge, effectiveCat, p.categories]);

  const isOverrideTab = effectiveAge !== null || effectiveCat !== null;

  const isValidUrl = (u: string) => {
    if (!u) return null;
    try { new URL(u); return true; } catch { return false; }
  };
  const urlValid = isValidUrl(p.streamUrl);
  const videoUrlValid = isValidUrl(p.armfightVideoUrl);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] tracking-[0.12em] uppercase text-[var(--color-primary)] font-semibold mb-2">
          {t('step_label', { current: 4, total: 4 })}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t('step4_title')}</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">{t('step4_subtitle')}</p>
      </div>

      <Section>
        <SectionTitle>{t('registration_section')}</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label>{t('registration_deadline_label')}</Label>
            <DateTimeInput value={p.registrationDeadline} onChange={p.setRegistrationDeadline} />
            <Helper>{t('registration_deadline_helper')}</Helper>
          </div>
          <div>
            <Label>{t('participant_cap_label')}</Label>
            <input
              type="number" min="2"
              value={p.maxParticipants}
              onChange={(e) => p.setMaxParticipants(e.target.value)}
              placeholder={t('advanced_unlimited_placeholder')}
              className="w-full h-12 px-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] [color-scheme:dark]"
            />
            <Helper>{t('participant_cap_helper')}</Helper>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md">
          <div>
            <div className="text-sm font-semibold">{t('registration_open_now')}</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{t('registration_open_helper')}</div>
          </div>
          <Toggle value={p.registrationOpenImmediately} onChange={p.setRegistrationOpenImmediately} />
        </div>
      </Section>

      <Section>
        <SectionTitle>{t('entry_fee_section')}</SectionTitle>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <button
            type="button"
            onClick={() => p.setEntryFeeType('free')}
            className={[
              'px-4 py-3 rounded-md border-2 text-left transition-all',
              p.entryFeeType === 'free'
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-dim)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]',
            ].join(' ')}
          >
            <div className="font-semibold text-base">{t('entry_fee_free')}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('entry_fee_free_desc')}</div>
          </button>
          <button
            type="button"
            onClick={() => p.setEntryFeeType('paid')}
            className={[
              'px-4 py-3 rounded-md border-2 text-left transition-all',
              p.entryFeeType === 'paid'
                ? 'border-[var(--color-primary)] bg-[var(--color-primary-dim)]'
                : 'border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]',
            ].join(' ')}
          >
            <div className="font-semibold text-base">{t('entry_fee_paid')}</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{t('entry_fee_paid_desc')}</div>
          </button>
        </div>
        {p.entryFeeType === 'paid' && (
          <div className="space-y-4 pt-2">
            <div>
              <Label>{t('entry_fee_amount_label')}</Label>
              <div className="relative">
                <input
                  type="number" min="0"
                  value={p.entryFeeAmount}
                  onChange={(e) => p.setEntryFeeAmount(e.target.value)}
                  placeholder={t('entry_fee_amount_placeholder')}
                  className="w-full h-14 pl-4 pr-16 text-2xl font-mono font-bold bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] [color-scheme:dark]"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-secondary)] pointer-events-none">{t('amd_suffix')}</div>
              </div>
            </div>
            <div>
              <Label>{t('entry_fee_conditions_label')}</Label>
              <textarea
                value={p.entryFeeConditions}
                onChange={(e) => p.setEntryFeeConditions(e.target.value)}
                rows={3}
                placeholder={t('entry_fee_conditions_placeholder')}
                className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] resize-y"
              />
            </div>
          </div>
        )}
      </Section>

      <Section>
        <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
          <SectionTitle inline>{t('prize_pool_title')}</SectionTitle>
          {(perBracketActive > 0 || tournamentTotal > 0) && (
            <div className="text-right">
              {perBracketActive > 0 && (
                <div className="text-xs text-[var(--color-text-secondary)]">
                  {t('prize_per_bracket')}{' '}
                  <span className="font-mono font-semibold text-white">
                    {perBracketActive.toLocaleString()} {t('amd_suffix')}
                  </span>
                </div>
              )}
              {tournamentTotal > 0 && (
                <div className="text-sm mt-0.5">
                  <span className="text-[var(--color-text-secondary)]">{t('prize_tournament_total')} </span>
                  <span className="font-mono font-bold text-[var(--color-accent)]">
                    {tournamentTotal.toLocaleString()} {t('amd_suffix')}
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-1">
                    {t(totalBrackets === 1 ? 'prize_brackets_count_one' : 'prize_brackets_count_other', { count: totalBrackets })}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <Helper>{t('prize_pool_helper')}</Helper>

        {showAgeTabs && (
          <div className="mt-4">
            <div className="text-[10px] tracking-[0.12em] uppercase font-semibold text-[var(--color-text-muted)] mb-1.5">{t('prize_age_group_label')}</div>
            <div className="flex flex-wrap gap-1.5 p-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md">
              <PrizeTabButton
                active={effectiveAge === null}
                onClick={() => setActiveAge(null)}
                label={t('prize_tab_all_ages')}
                hint={t('prize_tab_all_ages_hint')}
              />
              {AGE_GROUPS.filter((ag) => p.ageGroups.has(ag.id)).map((ag) => (
                <PrizeTabButton
                  key={ag.id}
                  active={effectiveAge === ag.id}
                  onClick={() => setActiveAge(ag.id)}
                  label={ageLabel(ag.id)}
                  badge={ageHasOverrides(ag.id) ? t('prize_override_badge') : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {showCatTabs && (
          <div className="mt-3">
            <div className="text-[10px] tracking-[0.12em] uppercase font-semibold text-[var(--color-text-muted)] mb-1.5">{t('prize_weight_category_label')}</div>
            <div className="flex flex-wrap gap-1.5 p-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md">
              <PrizeTabButton
                active={effectiveCat === null}
                onClick={() => setActiveCat(null)}
                label={t('prize_tab_all_weights')}
                hint={t('prize_tab_all_weights_hint')}
              />
              {p.categories.map((c) => (
                <PrizeTabButton
                  key={c.id}
                  active={effectiveCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                  label={categoryLabel(c)}
                  badge={catHasOverridesInActiveAge(c.id) ? t('prize_override_badge') : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {isOverrideTab && (
          <div className="mt-3 px-3 py-2 bg-[var(--color-primary-dim)] border border-[var(--color-primary)]/30 rounded-md text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
            <div className="text-[var(--color-primary)] flex-shrink-0 mt-0.5">{Icon.info('h-3.5 w-3.5')}</div>
            <div>
              {t('prize_override_info_prefix')}
              <strong className="text-white">{scopeLabel}</strong>
              {t('prize_override_info_suffix')}
            </div>
          </div>
        )}
        {placeGroups.length === 0 ? (
          <div className="mt-4 text-center py-8 border-2 border-dashed border-[var(--color-border)] rounded-md">
            <div className="text-[var(--color-text-muted)] mb-3">{Icon.trophy('h-8 w-8 mx-auto')}</div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              {!isOverrideTab
                ? t('prize_empty_default')
                : t('prize_empty_override', { scope: scopeLabel })}
            </p>
            <button
              type="button"
              onClick={addPlace}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md transition-colors"
            >
              {Icon.plus('h-4 w-4')}
              {!isOverrideTab ? t('prize_add_first_place') : t('prize_add_override')}
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {placeGroups.map(([place, rewards]) => (
              <PlaceGroup
                key={place}
                place={place}
                rewards={rewards}
                onUpdateReward={updatePrize}
                onRemoveReward={removePrize}
                onAddReward={() => addRewardToPlace(place)}
                onRemovePlace={() => removePlace(place)}
              />
            ))}
            <button
              type="button"
              onClick={addPlace}
              className="w-full py-3 flex items-center justify-center gap-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-white border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-border-strong)] rounded-md transition-colors"
            >
              {Icon.plus('h-4 w-4')}
              {t('prize_add_another_place')}
            </button>
          </div>
        )}
      </Section>

      <Section>
        <SectionTitle>{t('stream_section')}</SectionTitle>
        <Helper>{t('stream_helper')}</Helper>
        <div className="mt-4">
          <Label>{t('stream_url_label')}</Label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none">
              {Icon.video()}
            </div>
            <input
              type="url"
              value={p.streamUrl}
              onChange={(e) => p.setStreamUrl(e.target.value)}
              placeholder={t('stream_url_placeholder')}
              className={[
                'w-full h-12 pl-10 pr-10 bg-[var(--color-surface-2)] border focus:ring-4 focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)]',
                urlValid === false ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20'
                : urlValid === true ? 'border-[var(--color-success)] focus:border-[var(--color-success)] focus:ring-[var(--color-success)]/20'
                : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-dim)]',
              ].join(' ')}
            />
            {urlValid === true && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-success)]">{Icon.check()}</div>
            )}
          </div>
          {urlValid === false && <div className="mt-1.5 text-xs text-[var(--color-error)]">{t('stream_url_invalid')}</div>}
        </div>
      </Section>

      {isArmfight && (
        <Section>
          <div className="flex items-center justify-between gap-4">
            <div>
              <SectionTitle inline>{ta('main_event_title')}</SectionTitle>
              <Helper>{ta('main_event_helper')}</Helper>
            </div>
            <Toggle value={p.isFeatured} onChange={p.setIsFeatured} />
          </div>

          <div className="mt-6">
            <SectionTitle>{ta('video_section')}</SectionTitle>
            <Helper>{ta('video_helper')}</Helper>
            <div className="mt-4">
              <Label>{ta('video_url_label')}</Label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none">
                  {Icon.video()}
                </div>
                <input
                  type="url"
                  value={p.armfightVideoUrl}
                  onChange={(e) => p.setArmfightVideoUrl(e.target.value)}
                  placeholder={ta('video_url_placeholder')}
                  className={[
                    'w-full h-12 pl-10 pr-10 bg-[var(--color-surface-2)] border focus:ring-4 focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)]',
                    videoUrlValid === false ? 'border-[var(--color-error)] focus:border-[var(--color-error)] focus:ring-[var(--color-error)]/20'
                    : videoUrlValid === true ? 'border-[var(--color-success)] focus:border-[var(--color-success)] focus:ring-[var(--color-success)]/20'
                    : 'border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-[var(--color-primary-dim)]',
                  ].join(' ')}
                />
                {videoUrlValid === true && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--color-success)]">{Icon.check()}</div>
                )}
              </div>
              {videoUrlValid === false && <div className="mt-1.5 text-xs text-[var(--color-error)]">{ta('video_url_invalid')}</div>}
            </div>
          </div>
        </Section>
      )}

      <ReviewBlock
        review={p.review}
        prizes={p.prizes}
        entryFeeType={p.entryFeeType}
        entryFeeAmount={p.entryFeeAmount}
        maxParticipants={p.maxParticipants}
        totalMoneyPrize={tournamentTotal}
        goToStep={p.goToStep}
      />
    </div>
  );
}

function PrizeTabButton({
  active,
  onClick,
  label,
  hint,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  hint?: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={hint}
      className={[
        'relative px-3 py-1.5 text-xs font-semibold uppercase tracking-wide rounded transition-colors',
        active
          ? 'bg-[var(--color-primary)] text-white'
          : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-[var(--color-background)]',
      ].join(' ')}
    >
      {label}
      {badge && (
        <span className="ml-1.5 inline-block px-1 py-px text-[9px] tracking-normal bg-[var(--color-accent)] text-black rounded uppercase font-bold">
          {badge}
        </span>
      )}
    </button>
  );
}
