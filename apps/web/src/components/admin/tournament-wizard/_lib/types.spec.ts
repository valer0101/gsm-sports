import { describe, it, expect } from 'vitest';
import { categoryLabel, newCatId, newPrizeId } from './types';
import type { WeightCat } from './types';

const cat = (overrides: Partial<WeightCat>): WeightCat => ({
  id: 'c1',
  minKg: null,
  maxKg: null,
  ...overrides,
});

describe('categoryLabel', () => {
  it('returns the explicit name when one is set', () => {
    expect(categoryLabel(cat({ name: 'Heavyweight' }))).toBe('Heavyweight');
  });

  it('prefers the name over weight bounds even when both are present', () => {
    // Display rule: if the organizer named the category, that label wins.
    // Numeric bounds remain on the entity for matchmaking but aren't shown.
    expect(
      categoryLabel(cat({ name: 'Open Cup', minKg: 70, maxKg: 80 })),
    ).toBe('Open Cup');
  });

  it('returns "Absolute" when neither min nor max is set', () => {
    expect(categoryLabel(cat({ minKg: null, maxKg: null }))).toBe('Absolute');
  });

  it('returns "{min}+ kg" for an open-ended upper bound (heaviest tier)', () => {
    expect(categoryLabel(cat({ minKg: 100, maxKg: null }))).toBe('100+ kg');
  });

  it('returns "{max} kg" for a capped upper bound (typical tier)', () => {
    expect(categoryLabel(cat({ minKg: 70, maxKg: 80 }))).toBe('80 kg');
  });

  it('returns just "{max} kg" when only max is set (lightest tier)', () => {
    expect(categoryLabel(cat({ minKg: null, maxKg: 60 }))).toBe('60 kg');
  });

  it('does not include a leading sign or unit space inconsistencies', () => {
    // Spot-check formatting: no double spaces, no missing unit.
    expect(categoryLabel(cat({ minKg: 90, maxKg: null }))).toMatch(/^90\+ kg$/);
    expect(categoryLabel(cat({ minKg: null, maxKg: 65 }))).toMatch(/^65 kg$/);
  });

  it('treats an empty name as missing (falls through to weight rules)', () => {
    // `name: ''` is falsy → the function moves on to the weight branches.
    expect(
      categoryLabel(cat({ name: '', minKg: null, maxKg: 70 })),
    ).toBe('70 kg');
  });

  it('handles fractional weights as-is', () => {
    expect(categoryLabel(cat({ minKg: 67.5, maxKg: null }))).toBe('67.5+ kg');
    expect(categoryLabel(cat({ minKg: null, maxKg: 72.5 }))).toBe('72.5 kg');
  });
});

describe('newCatId / newPrizeId', () => {
  // The wizard mints in-memory ids before the bracket is persisted; the
  // sequences live in module scope and are monotonic per-import. We don't
  // care about absolute values, only that successive calls differ and
  // each helper has its own counter.
  it('mints distinct ids on successive calls', () => {
    const a = newCatId();
    const b = newCatId();
    expect(a).not.toBe(b);
  });

  it('uses different prefixes per helper', () => {
    expect(newCatId()).toMatch(/^c\d+$/);
    expect(newPrizeId()).toMatch(/^p\d+$/);
  });

  it('cat and prize counters are independent', () => {
    const c1 = newCatId();
    const p1 = newPrizeId();
    const c2 = newCatId();
    const p2 = newPrizeId();
    // Order within each helper increments — strip the prefix to compare.
    const cNum = (id: string) => Number(id.slice(1));
    expect(cNum(c2)).toBeGreaterThan(cNum(c1));
    expect(cNum(p2)).toBeGreaterThan(cNum(p1));
  });
});
