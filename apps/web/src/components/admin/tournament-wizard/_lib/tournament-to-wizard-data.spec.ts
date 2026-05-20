import { describe, it, expect } from 'vitest';
import type { Tournament } from '@/types/api';
import { tournamentToWizardData } from './tournament-to-wizard-data';

function makeTournament(overrides: Partial<Tournament>): Tournament {
  return {
    id: 't1',
    slug: 'test-cup-2026',
    name: 'Test Cup 2026',
    nameRu: null,
    nameEn: null,
    nameHy: null,
    descriptionRu: null,
    descriptionEn: null,
    descriptionHy: null,
    startDate: '2026-06-01T10:00:00.000Z',
    endDate: null,
    location: 'Yerevan Arena',
    country: 'AM',
    city: 'Yerevan',
    format: 'double_elimination',
    maxParticipants: null,
    registrationOpen: false,
    registrationDeadline: null,
    bracketGenerated: false,
    status: 'upcoming',
    isFeatured: false,
    isLive: false,
    posterUrl: null,
    streamUrl: null,
    armfightVideoUrl: null,
    sport: { id: 's1', slug: 'armwrestling' } as Tournament['sport'],
    weightCategories: [],
    sportConfig: null,
    ...overrides,
  };
}

describe('tournamentToWizardData', () => {
  it('groups per-gender weight category rows back into one client category', () => {
    const t = makeTournament({
      weightCategories: [
        { id: 'a', name: '70', minWeight: 60, maxWeight: 70, gender: 'male', sortOrder: 0, weightToleranceKg: 1 },
        { id: 'b', name: '70', minWeight: 60, maxWeight: 70, gender: 'female', sortOrder: 1, weightToleranceKg: 1 },
        { id: 'c', name: '80+', minWeight: 80, maxWeight: null, gender: 'male', sortOrder: 2, weightToleranceKg: 1 },
      ],
    });
    const data = tournamentToWizardData(t);
    expect(data.categories).toHaveLength(2);
    expect(data.categories?.[0]).toMatchObject({ minKg: 60, maxKg: 70, name: '70' });
    expect(data.categories?.[1]).toMatchObject({ minKg: 80, maxKg: null, name: '80+' });
    expect(new Set(data.genders)).toEqual(new Set(['male', 'female']));
    expect(data.weightToleranceKg).toBe(1);
  });

  it('defaults genders to both when no weight categories exist', () => {
    const data = tournamentToWizardData(makeTournament({ weightCategories: [] }));
    expect(new Set(data.genders)).toEqual(new Set(['male', 'female']));
    expect(data.categories).toEqual([]);
  });

  it('maps both hands → "both" and a single hand straight through', () => {
    const both = tournamentToWizardData(makeTournament({ sportConfig: { hands: ['right', 'left'] } }));
    const single = tournamentToWizardData(makeTournament({ sportConfig: { hands: ['right'] } }));
    const empty = tournamentToWizardData(makeTournament({ sportConfig: {} }));
    expect(both.hand).toBe('both');
    expect(single.hand).toBe('right');
    expect(empty.hand).toBe('');
  });

  it('hydrates entry-fee, prizes, and feature flags from sportConfig', () => {
    const data = tournamentToWizardData(
      makeTournament({
        isFeatured: true,
        armfightVideoUrl: 'https://youtube.com/watch?v=abc',
        sportConfig: {
          entryFee: { type: 'paid', amount: 5000, description: 'cash on site' },
          prizes: [{ place: 1, type: 'money', amount: 100000 }],
        },
      }),
    );
    expect(data.entryFeeType).toBe('paid');
    expect(data.entryFeeAmount).toBe('5000');
    expect(data.entryFeeConditions).toBe('cash on site');
    expect(data.prizes).toHaveLength(1);
    expect(data.prizes?.[0]).toMatchObject({ place: 1, type: 'money', amount: '100000' });
    expect(data.isFeatured).toBe(true);
    expect(data.armfightVideoUrl).toBe('https://youtube.com/watch?v=abc');
  });

  it('maps a null armfight video URL to an empty string for the controlled input', () => {
    const data = tournamentToWizardData(makeTournament({ armfightVideoUrl: null }));
    expect(data.armfightVideoUrl).toBe('');
  });

  it('treats slug as a manual override (so name edits do not auto-overwrite it)', () => {
    const data = tournamentToWizardData(makeTournament({ slug: 'existing-slug-42' }));
    expect(data.slug).toBe('existing-slug-42');
  });

  it('coerces TypeORM decimal-as-string values to numbers (Step 3 calls .toFixed on these)', () => {
    // Postgres `decimal(5,2)` columns come back as strings via TypeORM, even
    // though the TS type says `number | null`. Step 3 does `c.maxKg.toFixed(1)`
    // and would crash on a string — the mapper must coerce.
    const t = makeTournament({
      weightCategories: [
        // Cast through unknown — we're intentionally simulating runtime values
        // that don't match the static type so we lock in the coercion.
        {
          id: 'a',
          name: '70',
          minWeight: '60.00' as unknown as number,
          maxWeight: '70.00' as unknown as number,
          gender: 'male',
          sortOrder: 0,
          weightToleranceKg: '0.50' as unknown as number,
        },
      ],
    });
    const data = tournamentToWizardData(t);
    expect(typeof data.categories?.[0].minKg).toBe('number');
    expect(typeof data.categories?.[0].maxKg).toBe('number');
    expect(data.categories?.[0].minKg).toBe(60);
    expect(data.categories?.[0].maxKg).toBe(70);
    expect(typeof data.weightToleranceKg).toBe('number');
    expect(data.weightToleranceKg).toBe(0.5);
  });
});
