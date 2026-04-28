import { describe, it, expect } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { fitsWeightCategory, assertFitsWeightCategory } from './weight-category.util';

const cat = (
  overrides: Partial<{
    name: string;
    minWeight: number | string | null;
    maxWeight: number | string | null;
    weightToleranceKg: number | string | null;
  }> = {},
) =>
  ({
    name: '70 кг',
    minWeight: 60 as number | string | null,
    maxWeight: 70 as number | string | null,
    weightToleranceKg: 0 as number | string | null,
    ...overrides,
  }) as Parameters<typeof fitsWeightCategory>[1];

describe('fitsWeightCategory', () => {
  it('accepts a weight inside (min, max] with zero tolerance', () => {
    expect(fitsWeightCategory(65, cat())).toBe(true);
    expect(fitsWeightCategory(70, cat())).toBe(true); // exact max is in
  });

  it('rejects exact min weight (lower bound is exclusive)', () => {
    expect(fitsWeightCategory(60, cat())).toBe(false);
  });

  it('rejects above max with zero tolerance', () => {
    expect(fitsWeightCategory(70.01, cat())).toBe(false);
    expect(fitsWeightCategory(75, cat())).toBe(false);
  });

  it('extends the upper bound by weightToleranceKg', () => {
    const c = cat({ weightToleranceKg: 1 });
    expect(fitsWeightCategory(70.5, c)).toBe(true);
    expect(fitsWeightCategory(71, c)).toBe(true); // max + tol still in
    expect(fitsWeightCategory(71.01, c)).toBe(false);
  });

  it('treats null minWeight as open lower bound (no rejection)', () => {
    const c = cat({ minWeight: null, maxWeight: 55 });
    expect(fitsWeightCategory(40, c)).toBe(true);
    expect(fitsWeightCategory(0.1, c)).toBe(true);
  });

  it('treats null maxWeight as open upper bound (tolerance ignored)', () => {
    const c = cat({ minWeight: 100, maxWeight: null, weightToleranceKg: 5 });
    expect(fitsWeightCategory(150, c)).toBe(true);
    expect(fitsWeightCategory(99, c)).toBe(false); // still rejects below min
  });

  it('handles null/undefined tolerance as zero (pre-migration rows)', () => {
    const c = cat({ weightToleranceKg: null as any });
    expect(fitsWeightCategory(70, c)).toBe(true);
    expect(fitsWeightCategory(70.5, c)).toBe(false);
  });

  it('coerces numeric-string columns from TypeORM decimal', () => {
    // pg returns `numeric` columns as strings — emulate that.
    const c = cat({ minWeight: '60.00', maxWeight: '70.00', weightToleranceKg: '1.50' });
    expect(fitsWeightCategory(70, c)).toBe(true);
    expect(fitsWeightCategory(71.5, c)).toBe(true);
    expect(fitsWeightCategory(71.51, c)).toBe(false);
    expect(fitsWeightCategory(60, c)).toBe(false);
  });
});

describe('assertFitsWeightCategory', () => {
  it('is a no-op when the weight fits', () => {
    expect(() => assertFitsWeightCategory(65, cat())).not.toThrow();
  });

  it('throws BadRequestException with limit incl. tolerance when above max', () => {
    expect(() => assertFitsWeightCategory(72, cat({ weightToleranceKg: 1 }))).toThrowError(
      /exceeds category limit \(71 kg incl\. tolerance\)/,
    );
  });

  it('throws BadRequestException of correct type', () => {
    try {
      assertFitsWeightCategory(72, cat());
      throw new Error('expected throw');
    } catch (err) {
      expect(err).toBeInstanceOf(BadRequestException);
    }
  });

  it('falls back to category-name message when there is no upper bound', () => {
    expect(() =>
      assertFitsWeightCategory(40, cat({ minWeight: 50, maxWeight: null, name: '+50 kg' })),
    ).toThrowError(/does not fit category "\+50 kg"/);
  });
});
