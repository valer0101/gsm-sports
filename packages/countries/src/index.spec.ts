import { describe, it, expect } from 'vitest';
import {
  normalizeToIso2,
  iso2ToFlag,
  iso2ToName,
  resolveCountry,
  COUNTRIES,
} from './index';

describe('normalizeToIso2', () => {
  it('returns null for empty / null / undefined / whitespace', () => {
    expect(normalizeToIso2(null)).toBeNull();
    expect(normalizeToIso2(undefined)).toBeNull();
    expect(normalizeToIso2('')).toBeNull();
    expect(normalizeToIso2('   ')).toBeNull();
  });

  it('resolves ISO-2 codes case-insensitively', () => {
    expect(normalizeToIso2('RU')).toBe('RU');
    expect(normalizeToIso2('ru')).toBe('RU');
    expect(normalizeToIso2(' Ru ')).toBe('RU');
  });

  it('resolves ISO-3 codes', () => {
    expect(normalizeToIso2('RUS')).toBe('RU');
    expect(normalizeToIso2('arm')).toBe('AM');
    expect(normalizeToIso2('USA')).toBe('US');
  });

  it('resolves canonical English names', () => {
    expect(normalizeToIso2('Russia')).toBe('RU');
    expect(normalizeToIso2('Armenia')).toBe('AM');
    expect(normalizeToIso2('United States')).toBe('US');
  });

  it('resolves Russian and Armenian names', () => {
    expect(normalizeToIso2('Россия')).toBe('RU');
    expect(normalizeToIso2('Армения')).toBe('AM');
    expect(normalizeToIso2('Հայաստան')).toBe('AM');
    expect(normalizeToIso2('Ռուսաստան')).toBe('RU');
  });

  it('resolves common aliases', () => {
    expect(normalizeToIso2('РФ')).toBe('RU');
    expect(normalizeToIso2('USA')).toBe('US');
    expect(normalizeToIso2('UK')).toBe('GB');
    expect(normalizeToIso2('Britain')).toBe('GB');
    expect(normalizeToIso2('Holland')).toBe('NL');
    expect(normalizeToIso2('Белоруссия')).toBe('BY');
    expect(normalizeToIso2('Кыргызстан')).toBe('KG');
    expect(normalizeToIso2('UAE')).toBe('AE');
  });

  it('strips diacritics and is case-insensitive', () => {
    expect(normalizeToIso2('Türkiye')).toBe('TR');
    expect(normalizeToIso2('TURKEY')).toBe('TR');
  });

  it('returns null for unknown input', () => {
    expect(normalizeToIso2('Atlantis')).toBeNull();
    expect(normalizeToIso2('XYZ')).toBeNull();
    expect(normalizeToIso2('???')).toBeNull();
  });
});

describe('iso2ToFlag', () => {
  it('returns flag emoji for valid ISO-2 codes', () => {
    expect(iso2ToFlag('RU')).toBe('🇷🇺');
    expect(iso2ToFlag('US')).toBe('🇺🇸');
    expect(iso2ToFlag('AM')).toBe('🇦🇲');
    expect(iso2ToFlag('GB')).toBe('🇬🇧');
  });

  it('accepts lowercase', () => {
    expect(iso2ToFlag('ru')).toBe('🇷🇺');
    expect(iso2ToFlag('am')).toBe('🇦🇲');
  });

  it('returns empty string for invalid input', () => {
    expect(iso2ToFlag(null)).toBe('');
    expect(iso2ToFlag(undefined)).toBe('');
    expect(iso2ToFlag('')).toBe('');
    expect(iso2ToFlag('R')).toBe('');
    expect(iso2ToFlag('RUS')).toBe('');
    expect(iso2ToFlag('R1')).toBe('');
    expect(iso2ToFlag('12')).toBe('');
  });

  it('works for codes outside our COUNTRIES table (algorithmic)', () => {
    // ZW is a valid ISO-2 not in our table — must still produce a flag
    expect(iso2ToFlag('ZW')).toBe('🇿🇼');
  });
});

describe('iso2ToName', () => {
  it('returns localized names', () => {
    expect(iso2ToName('RU', 'en')).toBe('Russia');
    expect(iso2ToName('RU', 'ru')).toBe('Россия');
    expect(iso2ToName('RU', 'hy')).toBe('Ռուսաստան');
  });

  it('falls back to Russian when Armenian missing', () => {
    // Iceland has no nameHy in our table
    expect(iso2ToName('IS', 'hy')).toBe('Исландия');
  });

  it('returns null for unknown code', () => {
    expect(iso2ToName('ZZ', 'en')).toBeNull();
    expect(iso2ToName(null, 'en')).toBeNull();
    expect(iso2ToName(undefined, 'en')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(iso2ToName('ru', 'en')).toBe('Russia');
  });
});

describe('resolveCountry', () => {
  it('returns full bundle for known input', () => {
    const r = resolveCountry('Россия', 'en');
    expect(r).toEqual({
      iso2: 'RU',
      flag: '🇷🇺',
      name: 'Russia',
      raw: 'Россия',
    });
  });

  it('preserves raw input when normalization fails', () => {
    const r = resolveCountry('Atlantis', 'en');
    expect(r).toEqual({
      iso2: null,
      flag: '',
      name: null,
      raw: 'Atlantis',
    });
  });

  it('handles null/empty cleanly', () => {
    const r = resolveCountry(null, 'en');
    expect(r).toEqual({ iso2: null, flag: '', name: null, raw: null });
  });
});

describe('data integrity', () => {
  it('every record has unique ISO-2', () => {
    const seen = new Set<string>();
    for (const c of COUNTRIES) {
      expect(seen.has(c.iso2)).toBe(false);
      seen.add(c.iso2);
    }
  });

  it('every record has unique ISO-3', () => {
    const seen = new Set<string>();
    for (const c of COUNTRIES) {
      expect(seen.has(c.iso3)).toBe(false);
      seen.add(c.iso3);
    }
  });

  it('ISO-2 codes are exactly 2 uppercase letters', () => {
    for (const c of COUNTRIES) {
      expect(c.iso2).toMatch(/^[A-Z]{2}$/);
    }
  });

  it('ISO-3 codes are exactly 3 uppercase letters', () => {
    for (const c of COUNTRIES) {
      expect(c.iso3).toMatch(/^[A-Z]{3}$/);
    }
  });
});
