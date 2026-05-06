import type { AgeGroup, Prize, WeightCat } from './types';

export function sumMoney(prizes: Prize[]): number {
  return prizes
    .filter((p) => p.type === 'money' && p.amount)
    .reduce((sum, p) => sum + (parseFloat(p.amount || '0') || 0), 0);
}

/**
 * Effective prizes for one (ageGroup, weightCategory) pair. Resolution order
 * (most specific wins):
 *   1. prizes scoped to this exact (age, category) pair
 *   2. prizes scoped to this age but no category (age-wide overrides)
 *   3. prizes scoped to this category but no age (category-wide overrides)
 *   4. fully default prizes (no age, no category)
 *
 * Each step short-circuits — if level 1 has any matches, levels 2-4 are
 * ignored for this pair. This mirrors how a CSS-style cascade would feel
 * to an admin who's drilling into a tab.
 */
export function effectivePrizes(
  prizes: Prize[],
  ageGroup: AgeGroup | null,
  weightCategoryId: string | null,
): Prize[] {
  const exact = prizes.filter(
    (p) => p.ageGroup === (ageGroup ?? undefined) && p.weightCategoryId === (weightCategoryId ?? undefined),
  );
  if (exact.length > 0) return exact;

  if (ageGroup && weightCategoryId) {
    const ageOnly = prizes.filter((p) => p.ageGroup === ageGroup && !p.weightCategoryId);
    if (ageOnly.length > 0) return ageOnly;

    const catOnly = prizes.filter((p) => !p.ageGroup && p.weightCategoryId === weightCategoryId);
    if (catOnly.length > 0) return catOnly;
  }

  if (ageGroup && !weightCategoryId) {
    const ageOnly = prizes.filter((p) => p.ageGroup === ageGroup && !p.weightCategoryId);
    if (ageOnly.length > 0) return ageOnly;
  }

  if (!ageGroup && weightCategoryId) {
    const catOnly = prizes.filter((p) => !p.ageGroup && p.weightCategoryId === weightCategoryId);
    if (catOnly.length > 0) return catOnly;
  }

  return prizes.filter((p) => !p.ageGroup && !p.weightCategoryId);
}

/**
 * Brackets for one (age, category) pair: just hands × genders, since one
 * bracket per pair. Multiplied by category count and age-group count when
 * computing tournament totals.
 */
export function bracketsPerPair(handMul: number, genderCount: number): number {
  return handMul * genderCount;
}

/**
 * Total payout across the whole tournament. Walks every (age × category)
 * pair, finds the effective prize set via override cascade, and sums the
 * money × per-pair bracket count.
 */
export function totalTournamentPayout(
  prizes: Prize[],
  selectedAgeGroups: Set<AgeGroup>,
  categories: WeightCat[],
  handMul: number,
  genderCount: number,
): number {
  const ageList: (AgeGroup | null)[] = selectedAgeGroups.size === 0
    ? [null]
    : Array.from(selectedAgeGroups);

  const catList: (string | null)[] = categories.length === 0
    ? [null]
    : categories.map((c) => c.id);

  const perPair = bracketsPerPair(handMul, genderCount);

  let total = 0;
  for (const age of ageList) {
    for (const cat of catList) {
      const set = effectivePrizes(prizes, age, cat);
      total += sumMoney(set) * perPair;
    }
  }
  return total;
}
