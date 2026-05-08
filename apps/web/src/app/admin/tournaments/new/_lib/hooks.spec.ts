import { describe, it, expect, vi } from 'vitest';
import type { Sport } from '@/types/api';

// `hooks.ts` re-exports `useSports` from `@/hooks/useAthletes`, which transi-
// tively pulls in `@/lib/api` (Axios instance) and React Query. None of that
// is exercised by the pure-function tests below, so we stub the upstream
// module out to keep this spec free of network/React-Query baggage.
vi.mock('@/hooks/useAthletes', () => ({
  useSports: () => ({ data: undefined, isLoading: false, error: null }),
}));

import { pickSportName, pickSportEmoji } from './hooks';

const sport = (overrides: Partial<Sport>): Sport =>
  ({
    id: 's1',
    slug: 'armwrestling',
    nameRu: '',
    nameEn: '',
    nameHy: '',
    isActive: true,
    ...overrides,
  }) as Sport;

describe('pickSportName', () => {
  it('returns empty string for an undefined sport (loading state)', () => {
    expect(pickSportName(undefined)).toBe('');
  });

  it('prefers Russian name when set', () => {
    expect(
      pickSportName(sport({ nameRu: 'Армрестлинг', nameEn: 'Armwrestling', nameHy: 'Բազկամարտ' })),
    ).toBe('Армрестлинг');
  });

  it('falls back to English when Russian is missing', () => {
    expect(
      pickSportName(sport({ nameRu: '', nameEn: 'Armwrestling', nameHy: 'Բազկամարտ' })),
    ).toBe('Armwrestling');
  });

  it('falls back to Armenian when Russian and English are missing', () => {
    expect(
      pickSportName(sport({ nameRu: '', nameEn: '', nameHy: 'Բազկամարտ' })),
    ).toBe('Բազկամարտ');
  });

  it('falls back to slug as the last resort', () => {
    expect(
      pickSportName(
        sport({ slug: 'mma', nameRu: '', nameEn: '', nameHy: '' }),
      ),
    ).toBe('mma');
  });

  it('treats a name of "0" as truthy and returns it', () => {
    // The current truthy-fallback uses `||`. A literal "0" string is truthy
    // for `||`, so it would be returned. This test pins that behavior so a
    // future refactor (e.g. switching to `??`) doesn't silently change the
    // semantics for organisers who name a sport "0".
    expect(
      pickSportName(sport({ nameRu: '0', nameEn: 'X', nameHy: 'Y' })),
    ).toBe('0');
  });
});

describe('pickSportEmoji', () => {
  it.each([
    ['armwrestling', '💪'],
    ['mma', '🥋'],
    ['boxing', '🥊'],
    ['wrestling', '🤼'],
    ['kickboxing', '🦵'],
  ])('maps %s → %s', (slug, emoji) => {
    expect(pickSportEmoji(slug)).toBe(emoji);
  });

  it('falls back to a generic trophy for unknown slugs', () => {
    expect(pickSportEmoji('judo')).toBe('🏆');
    expect(pickSportEmoji('chess')).toBe('🏆');
    expect(pickSportEmoji('grappling')).toBe('🏆');
  });

  it('falls back for undefined / empty slug', () => {
    expect(pickSportEmoji(undefined)).toBe('🏆');
    expect(pickSportEmoji('')).toBe('🏆');
  });

  it('is case-sensitive — uppercase / mixed slugs do not match', () => {
    // The slug pipeline normalises to lowercase before storing, so an upper-
    // case input here means upstream data is already wrong; the safe move
    // is fall-through to the generic icon rather than guess.
    expect(pickSportEmoji('Armwrestling')).toBe('🏆');
    expect(pickSportEmoji('MMA')).toBe('🏆');
  });
});
