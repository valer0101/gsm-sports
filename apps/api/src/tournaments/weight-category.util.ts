import { WeightCategory } from './entities/weight-category.entity';

/**
 * Category membership: `(min, max + tolerance]` — exclusive on the lower
 * bound (athletes at the exact min weight belong to the heavier category)
 * and inclusive on the upper bound, extended by `weightToleranceKg`.
 *
 * Nullable bounds mean "open" on that side (a -55kg category has
 * `minWeight = null`, a +100kg has `maxWeight = null`). Tolerance is
 * ignored when `maxWeight` is null — there's no upper bound to relax.
 */
export function fitsWeightCategory(
  weight: number,
  c: Pick<WeightCategory, 'minWeight' | 'maxWeight' | 'weightToleranceKg'>,
): boolean {
  if (c.minWeight !== null && weight <= Number(c.minWeight)) return false;
  if (c.maxWeight !== null) {
    const tolerance = Number(c.weightToleranceKg ?? 0);
    if (weight > Number(c.maxWeight) + tolerance) return false;
  }
  return true;
}
