'use client';

import { useMemo, useState } from 'react';
import { Icon } from '../../_lib/icons';
import { type AgeGroup, type Prize, type EntryFeeType, type ReviewData, type WeightCat, categoryLabel, newPrizeId } from '../../_lib/types';
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
    if (effectiveAge) parts.push(AGE_GROUPS.find((g) => g.id === effectiveAge)?.label.toLowerCase() ?? effectiveAge);
    if (effectiveCat) {
      const cat = p.categories.find((c) => c.id === effectiveCat);
      if (cat) parts.push(categoryLabel(cat));
    }
    return parts.join(' · ');
  }, [effectiveAge, effectiveCat, p.categories]);

  const isOverrideTab = effectiveAge !== null || effectiveCat !== null;

  const isValidUrl = (u: string) => {
    if (!u) return null;
    try { new URL(u); return true; } catch { return false; }
  };
  const urlValid = isValidUrl(p.streamUrl);

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] tracking-[0.12em] uppercase text-[var(--color-primary)] font-semibold mb-2">Step 4 of 4</div>
        <h1 className="text-3xl font-extrabold tracking-tight">Registration &amp; Prizes</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Final touches before launch.</p>
      </div>

      <Section>
        <SectionTitle>Registration</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label>Registration deadline</Label>
            <DateTimeInput value={p.registrationDeadline} onChange={p.setRegistrationDeadline} />
            <Helper>Last moment athletes can sign up. Defaults to 24h before start.</Helper>
          </div>
          <div>
            <Label>Total participant cap</Label>
            <input
              type="number" min="2"
              value={p.maxParticipants}
              onChange={(e) => p.setMaxParticipants(e.target.value)}
              placeholder="Unlimited"
              className="w-full h-12 px-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] [color-scheme:dark]"
            />
            <Helper>Across all categories. Leave blank for no cap.</Helper>
          </div>
        </div>
        <div className="mt-5 flex items-center justify-between gap-4 px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md">
          <div>
            <div className="text-sm font-semibold">Open registration immediately</div>
            <div className="text-xs text-[var(--color-text-muted)] mt-0.5">If off, tournament saves as draft and registration opens manually later.</div>
          </div>
          <Toggle value={p.registrationOpenImmediately} onChange={p.setRegistrationOpenImmediately} />
        </div>
      </Section>

      <Section>
        <SectionTitle>Entry fee</SectionTitle>
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
            <div className="font-semibold text-base">Free</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">No entry fee for athletes.</div>
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
            <div className="font-semibold text-base">Paid</div>
            <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">Athletes pay to register.</div>
          </button>
        </div>
        {p.entryFeeType === 'paid' && (
          <div className="space-y-4 pt-2">
            <div>
              <Label>Amount</Label>
              <div className="relative">
                <input
                  type="number" min="0"
                  value={p.entryFeeAmount}
                  onChange={(e) => p.setEntryFeeAmount(e.target.value)}
                  placeholder="5000"
                  className="w-full h-14 pl-4 pr-16 text-2xl font-mono font-bold bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] [color-scheme:dark]"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-[var(--color-text-secondary)] pointer-events-none">AMD</div>
              </div>
            </div>
            <div>
              <Label>Conditions (optional)</Label>
              <textarea
                value={p.entryFeeConditions}
                onChange={(e) => p.setEntryFeeConditions(e.target.value)}
                rows={3}
                placeholder="Refund policy, payment method, deadlines..."
                className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] resize-y"
              />
            </div>
          </div>
        )}
      </Section>

      <Section>
        <div className="flex items-start justify-between gap-4 mb-2 flex-wrap">
          <SectionTitle inline>Prize pool</SectionTitle>
          {(perBracketActive > 0 || tournamentTotal > 0) && (
            <div className="text-right">
              {perBracketActive > 0 && (
                <div className="text-xs text-[var(--color-text-secondary)]">
                  Per bracket:{' '}
                  <span className="font-mono font-semibold text-white">
                    {perBracketActive.toLocaleString()} AMD
                  </span>
                </div>
              )}
              {tournamentTotal > 0 && (
                <div className="text-sm mt-0.5">
                  <span className="text-[var(--color-text-secondary)]">Tournament total: </span>
                  <span className="font-mono font-bold text-[var(--color-accent)]">
                    {tournamentTotal.toLocaleString()} AMD
                  </span>
                  <span className="text-xs text-[var(--color-text-muted)] ml-1">
                    ({totalBrackets} bracket{totalBrackets === 1 ? '' : 's'})
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
        <Helper>Add prizes per place. Each place can hold multiple rewards (money + trophy + certificate, etc.).</Helper>

        {showAgeTabs && (
          <div className="mt-4">
            <div className="text-[10px] tracking-[0.12em] uppercase font-semibold text-[var(--color-text-muted)] mb-1.5">Age group</div>
            <div className="flex flex-wrap gap-1.5 p-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md">
              <PrizeTabButton
                active={effectiveAge === null}
                onClick={() => setActiveAge(null)}
                label="All ages"
                hint="Applies to every age group unless overridden"
              />
              {AGE_GROUPS.filter((ag) => p.ageGroups.has(ag.id)).map((ag) => (
                <PrizeTabButton
                  key={ag.id}
                  active={effectiveAge === ag.id}
                  onClick={() => setActiveAge(ag.id)}
                  label={ag.label}
                  badge={ageHasOverrides(ag.id) ? 'override' : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {showCatTabs && (
          <div className="mt-3">
            <div className="text-[10px] tracking-[0.12em] uppercase font-semibold text-[var(--color-text-muted)] mb-1.5">Weight category</div>
            <div className="flex flex-wrap gap-1.5 p-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md">
              <PrizeTabButton
                active={effectiveCat === null}
                onClick={() => setActiveCat(null)}
                label="All weights"
                hint="Applies to every weight category unless overridden"
              />
              {p.categories.map((c) => (
                <PrizeTabButton
                  key={c.id}
                  active={effectiveCat === c.id}
                  onClick={() => setActiveCat(c.id)}
                  label={categoryLabel(c)}
                  badge={catHasOverridesInActiveAge(c.id) ? 'override' : undefined}
                />
              ))}
            </div>
          </div>
        )}

        {isOverrideTab && (
          <div className="mt-3 px-3 py-2 bg-[var(--color-primary-dim)] border border-[var(--color-primary)]/30 rounded-md text-xs text-[var(--color-text-secondary)] flex items-start gap-2">
            <div className="text-[var(--color-primary)] flex-shrink-0 mt-0.5">{Icon.info('h-3.5 w-3.5')}</div>
            <div>
              Prizes here override the more general pool for{' '}
              <strong className="text-white">{scopeLabel}</strong>{' '}
              brackets only. Leave empty to inherit the next-broader scope.
            </div>
          </div>
        )}
        {placeGroups.length === 0 ? (
          <div className="mt-4 text-center py-8 border-2 border-dashed border-[var(--color-border)] rounded-md">
            <div className="text-[var(--color-text-muted)] mb-3">{Icon.trophy('h-8 w-8 mx-auto')}</div>
            <p className="text-xs text-[var(--color-text-muted)] mb-3">
              {!isOverrideTab
                ? 'No prizes yet.'
                : `No overrides for ${scopeLabel} — falls back to broader scope.`}
            </p>
            <button
              type="button"
              onClick={addPlace}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-md transition-colors"
            >
              {Icon.plus('h-4 w-4')}
              {!isOverrideTab ? 'Add first place' : 'Add override'}
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
              Add another place
            </button>
          </div>
        )}
      </Section>

      <Section>
        <SectionTitle>Live stream</SectionTitle>
        <Helper>YouTube, Twitch, Kick — paste live stream link if you&apos;ll broadcast.</Helper>
        <div className="mt-4">
          <Label>Stream URL</Label>
          <div className="relative">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] pointer-events-none">
              {Icon.video()}
            </div>
            <input
              type="url"
              value={p.streamUrl}
              onChange={(e) => p.setStreamUrl(e.target.value)}
              placeholder="https://youtube.com/live/..."
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
          {urlValid === false && <div className="mt-1.5 text-xs text-[var(--color-error)]">Not a valid URL.</div>}
        </div>
      </Section>

      <Section>
        <div className="flex items-center justify-between gap-4">
          <div>
            <SectionTitle inline>Feature on homepage</SectionTitle>
            <Helper>Featured tournaments appear in the hero carousel on the homepage.</Helper>
          </div>
          <Toggle value={p.isFeatured} onChange={p.setIsFeatured} />
        </div>
      </Section>

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
