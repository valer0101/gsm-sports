import { describe, it, expect } from 'vitest';
import {
  sumMoney,
  effectivePrizes,
  bracketsPerPair,
  totalTournamentPayout,
} from './prize-calc';
import type { AgeGroup, Prize, WeightCat } from './types';

const money = (id: string, place: number, amount: string, scope: Partial<Prize> = {}): Prize => ({
  id, place, type: 'money', amount, ...scope,
});
const medal = (id: string, place: number, scope: Partial<Prize> = {}): Prize => ({
  id, place, type: 'medal', description: 'Gold medal', ...scope,
});

const cat = (id: string, minKg: number | null, maxKg: number | null): WeightCat => ({
  id, minKg, maxKg,
});

describe('sumMoney', () => {
  it('adds money entries and ignores non-money entries', () => {
    const prizes = [
      money('a', 1, '100000'),
      medal('b', 2),
      money('c', 3, '50000'),
    ];
    expect(sumMoney(prizes)).toBe(150_000);
  });

  it('treats missing or empty amount as zero', () => {
    expect(sumMoney([money('a', 1, ''), { id: 'b', place: 2, type: 'money' }])).toBe(0);
  });

  it('returns 0 for an empty list', () => {
    expect(sumMoney([])).toBe(0);
  });
});

describe('effectivePrizes — override cascade', () => {
  const ageOnly: Prize = money('age', 1, '500', { ageGroup: 'juniors' });
  const catOnly: Prize = money('cat', 1, '300', { weightCategoryId: 'cat-65' });
  const exact: Prize = money('exact', 1, '100', { ageGroup: 'juniors', weightCategoryId: 'cat-65' });
  const def: Prize = money('def', 1, '900');

  it('uses the exact (age, category) match when present', () => {
    const set = effectivePrizes([def, ageOnly, catOnly, exact], 'juniors', 'cat-65');
    expect(set.map((p) => p.id)).toEqual(['exact']);
  });

  it('falls back from (age, cat) → (age, *) when no exact match', () => {
    const set = effectivePrizes([def, ageOnly, catOnly], 'juniors', 'cat-65');
    expect(set.map((p) => p.id)).toEqual(['age']);
  });

  it('falls back from (age, cat) → (*, cat) when no age-only override exists', () => {
    const set = effectivePrizes([def, catOnly], 'juniors', 'cat-65');
    expect(set.map((p) => p.id)).toEqual(['cat']);
  });

  it('falls back to default when no overrides match', () => {
    const set = effectivePrizes([def], 'juniors', 'cat-65');
    expect(set.map((p) => p.id)).toEqual(['def']);
  });

  it('returns an empty list when there is nothing scoped or default', () => {
    const set = effectivePrizes([catOnly], 'juniors', 'cat-other');
    expect(set).toEqual([]);
  });
});

describe('bracketsPerPair', () => {
  it('multiplies hand and gender counts', () => {
    expect(bracketsPerPair(1, 1)).toBe(1);
    expect(bracketsPerPair(2, 1)).toBe(2);
    expect(bracketsPerPair(2, 2)).toBe(4);
  });
});

describe('totalTournamentPayout', () => {
  const cats: WeightCat[] = [
    cat('cat-50', 0, 50),
    cat('cat-65', 50, 65),
    cat('cat-80', 65, 80),
  ];
  const ageGroups = new Set<AgeGroup>(['juniors', 'adults', 'veterans']);

  it('multiplies a uniform default pool by every (age × category) pair', () => {
    // 3 ages × 3 categories × 2 hands × 2 genders × 100k = 3,600,000
    const prizes = [money('a', 1, '100000')];
    const total = totalTournamentPayout(prizes, ageGroups, cats, 2, 2);
    expect(total).toBe(3_600_000);
  });

  it('substitutes age-scoped overrides for that age groups slice', () => {
    const prizes = [
      money('def', 1, '100000'),
      money('vet', 1, '20000', { ageGroup: 'veterans' }),
    ];
    // juniors + adults: default 100k × 3 cats × 4 brackets/pair = 2 × 1,200,000 = 2,400,000
    // veterans:        20k × 3 cats × 4 brackets/pair             = 240,000
    const total = totalTournamentPayout(prizes, ageGroups, cats, 2, 2);
    expect(total).toBe(2_640_000);
  });

  it('substitutes (age, category) overrides for the most-specific slice only', () => {
    const prizes = [
      money('def', 1, '100000'),
      money('jun65', 1, '10000', { ageGroup: 'juniors', weightCategoryId: 'cat-65' }),
    ];
    // juniors-50:  default 100k × 4 = 400,000
    // juniors-65:  override 10k × 4 = 40,000
    // juniors-80:  default 100k × 4 = 400,000
    // adults × 3:  default 100k × 4 × 3 = 1,200,000
    // veterans × 3: same                 = 1,200,000
    // Total = 400 + 40 + 400 + 1200 + 1200 = 3240k
    const total = totalTournamentPayout(prizes, ageGroups, cats, 2, 2);
    expect(total).toBe(3_240_000);
  });

  it('ignores prize types other than money', () => {
    const prizes = [
      medal('m', 1),
      money('def', 1, '100000'),
    ];
    const total = totalTournamentPayout(prizes, ageGroups, cats, 2, 2);
    expect(total).toBe(3_600_000);
  });

  it('treats no age groups as a single bucket', () => {
    const prizes = [money('a', 1, '100000')];
    const noAges = new Set<AgeGroup>();
    // 1 × 3 cats × 2 hands × 2 genders × 100k = 1,200,000
    expect(totalTournamentPayout(prizes, noAges, cats, 2, 2)).toBe(1_200_000);
  });

  it('treats no weight categories as a single bucket', () => {
    const prizes = [money('a', 1, '100000')];
    // 3 ages × 1 (no cats fallback) × 2 × 2 × 100k = 1,200,000
    expect(totalTournamentPayout(prizes, ageGroups, [], 2, 2)).toBe(1_200_000);
  });

  it('returns 0 when there are no money prizes', () => {
    const prizes = [medal('m', 1)];
    expect(totalTournamentPayout(prizes, ageGroups, cats, 2, 2)).toBe(0);
  });

  it('respects the gender count multiplier (men-only tournament halves the total)', () => {
    const prizes = [money('a', 1, '100000')];
    expect(totalTournamentPayout(prizes, ageGroups, cats, 2, 2)).toBe(3_600_000);
    expect(totalTournamentPayout(prizes, ageGroups, cats, 2, 1)).toBe(1_800_000);
  });
});
