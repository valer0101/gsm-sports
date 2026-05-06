import type { AgeGroup, Prize } from './types';

/**
 * Sum of money rewards in the given prize list. Non-money entries
 * contribute 0 (a trophy isn't a number).
 */
export function sumMoney(prizes: Prize[]): number {
  return prizes
    .filter((p) => p.type === 'money' && p.amount)
    .reduce((sum, p) => sum + (parseFloat(p.amount || '0') || 0), 0);
}

/** Prizes belonging to the "default" bucket — no ageGroup override. */
export function defaultPrizes(prizes: Prize[]): Prize[] {
  return prizes.filter((p) => !p.ageGroup);
}

/** Prizes that explicitly override for the given age group. */
export function overridePrizes(prizes: Prize[], group: AgeGroup): Prize[] {
  return prizes.filter((p) => p.ageGroup === group);
}

/**
 * The prizes that actually apply to a given age group's brackets.
 * If the group has its own overrides, those replace the default; otherwise
 * the default prizes apply.
 */
export function effectivePrizesForGroup(prizes: Prize[], group: AgeGroup): Prize[] {
  const overrides = overridePrizes(prizes, group);
  return overrides.length > 0 ? overrides : defaultPrizes(prizes);
}

/**
 * Brackets per age group: weight categories × hand multiplier × 2 (M/F).
 * Each age group has this many brackets, each awarding the prize set.
 */
export function bracketsPerGroup(categoryCount: number, handMul: number): number {
  return categoryCount * handMul * 2;
}

/**
 * Total tournament payout. Walks every age group's brackets and sums
 * the money for each, falling back to default prizes when a group has no
 * override. When no age groups are configured (open competition) all
 * brackets share the default pool.
 */
export function totalTournamentPayout(
  prizes: Prize[],
  selectedAgeGroups: Set<AgeGroup>,
  categoryCount: number,
  handMul: number,
): number {
  const perBracket = (group: AgeGroup | null) =>
    sumMoney(group === null ? defaultPrizes(prizes) : effectivePrizesForGroup(prizes, group));

  const bracketsForGroup = bracketsPerGroup(categoryCount, handMul);

  if (selectedAgeGroups.size === 0) {
    // No age filtering — single pool, single bracket count.
    return perBracket(null) * bracketsForGroup;
  }

  let total = 0;
  for (const group of selectedAgeGroups) {
    total += perBracket(group) * bracketsForGroup;
  }
  return total;
}
