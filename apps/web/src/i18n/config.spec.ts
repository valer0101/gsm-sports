import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_COOKIE,
  LOCALE_COOKIE_MAX_AGE,
  isLocale,
  pickLocaleFromAcceptLanguage,
} from './config';

describe('i18n constants', () => {
  it('exposes the supported locale set', () => {
    expect(LOCALES).toEqual(['ru', 'en', 'hy']);
  });

  it('defaults to Armenian (hy) — the platform is Armenia-first', () => {
    expect(DEFAULT_LOCALE).toBe('hy');
    expect(LOCALES).toContain(DEFAULT_LOCALE);
  });

  it('uses a stable cookie name with a 1-year max-age', () => {
    expect(LOCALE_COOKIE).toBe('gsm_lang');
    expect(LOCALE_COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 365);
  });
});

describe('isLocale', () => {
  it('accepts every supported locale verbatim', () => {
    for (const code of LOCALES) {
      expect(isLocale(code)).toBe(true);
    }
  });

  it('rejects unknown locales', () => {
    expect(isLocale('fr')).toBe(false);
    expect(isLocale('de')).toBe(false);
    expect(isLocale('zh')).toBe(false);
  });

  it('rejects empty / nullish input', () => {
    expect(isLocale('')).toBe(false);
    expect(isLocale(undefined)).toBe(false);
    expect(isLocale(null)).toBe(false);
  });

  it('is case-sensitive — uppercase tags are NOT recognised', () => {
    // The cookie / URL pipeline only ever stores lowercase; a stray upper-
    // case value is treated as invalid so the middleware re-detects.
    expect(isLocale('EN')).toBe(false);
    expect(isLocale('Ru')).toBe(false);
  });

  it('rejects lookalikes that contain a valid prefix', () => {
    expect(isLocale('en-US')).toBe(false);
    expect(isLocale('ru_RU')).toBe(false);
    expect(isLocale('eng')).toBe(false);
  });
});

describe('pickLocaleFromAcceptLanguage', () => {
  it('returns null for null / undefined / empty headers', () => {
    expect(pickLocaleFromAcceptLanguage(null)).toBeNull();
    expect(pickLocaleFromAcceptLanguage(undefined)).toBeNull();
    expect(pickLocaleFromAcceptLanguage('')).toBeNull();
  });

  it('picks the only-listed supported locale', () => {
    expect(pickLocaleFromAcceptLanguage('en')).toBe('en');
    expect(pickLocaleFromAcceptLanguage('ru')).toBe('ru');
    expect(pickLocaleFromAcceptLanguage('hy')).toBe('hy');
  });

  it('strips region tags down to the base language', () => {
    expect(pickLocaleFromAcceptLanguage('en-US')).toBe('en');
    expect(pickLocaleFromAcceptLanguage('ru-RU')).toBe('ru');
    expect(pickLocaleFromAcceptLanguage('hy-AM')).toBe('hy');
  });

  it('lowercases the tag before matching', () => {
    expect(pickLocaleFromAcceptLanguage('EN-US')).toBe('en');
    expect(pickLocaleFromAcceptLanguage('RU')).toBe('ru');
  });

  it('honours q-weights — highest q wins', () => {
    // Browser sends de first (default 1.0), then en at 0.8.
    // German is unsupported, so en wins.
    expect(
      pickLocaleFromAcceptLanguage('de;q=0.6, en;q=0.8, fr;q=0.7'),
    ).toBe('en');
  });

  it('treats missing q as 1.0 (RFC 7231 default)', () => {
    expect(pickLocaleFromAcceptLanguage('fr, en;q=0.5')).toBe('en');
    // The first listed language has implicit q=1, but it's unsupported;
    // explicit q=0.5 fallback is then chosen.
  });

  it('falls back to the next-highest supported locale', () => {
    // German preferred but unsupported → ru is next-best supported.
    expect(
      pickLocaleFromAcceptLanguage('de, fr;q=0.9, ru;q=0.7, en;q=0.5'),
    ).toBe('ru');
  });

  it('returns null when no supported locale appears at any q', () => {
    expect(pickLocaleFromAcceptLanguage('de, fr;q=0.9, zh;q=0.7')).toBeNull();
  });

  it('skips q=0 entries (RFC 7231 — explicit "do not want")', () => {
    // A client can send `en;q=0` to opt OUT of English. We must respect
    // that and look further down the list.
    expect(
      pickLocaleFromAcceptLanguage('en;q=0, ru;q=0.5'),
    ).toBe('ru');
  });

  it('treats malformed q (NaN) as 0 — entry is dropped', () => {
    // Per RFC 7231 §5.3.1, an unparseable q value invalidates the entry.
    expect(
      pickLocaleFromAcceptLanguage('en;q=abc, ru;q=0.5'),
    ).toBe('ru');
  });

  it('handles whitespace and odd capitalisation around delimiters', () => {
    expect(
      pickLocaleFromAcceptLanguage('  en-US ;  q=0.9 ,  RU ; q=0.7  '),
    ).toBe('en');
  });

  it('preserves stable order on ties — first listed wins', () => {
    // Both at implicit q=1; en comes first → en wins.
    expect(pickLocaleFromAcceptLanguage('en, ru')).toBe('en');
    expect(pickLocaleFromAcceptLanguage('ru, en')).toBe('ru');
  });

  it('ignores non-q parameters', () => {
    // RFC 7231 only defines q; other params (e.g. weights some clients
    // misinvent) must be parsed and ignored without affecting selection.
    expect(
      pickLocaleFromAcceptLanguage('en;weight=0.9, ru;q=0.5'),
    ).toBe('en');
  });

  it('returns null on a malformed-only header', () => {
    expect(pickLocaleFromAcceptLanguage(';;;')).toBeNull();
    expect(pickLocaleFromAcceptLanguage(',,,')).toBeNull();
  });
});
