import { describe, it, expect } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and joins ASCII words with dashes', () => {
    expect(slugify('Yerevan Open 2026')).toBe('yerevan-open-2026');
  });

  it('strips characters that arent letters, digits, or spaces', () => {
    expect(slugify('Cup #1: Heavyweight!')).toBe('cup-1-heavyweight');
  });

  it('collapses runs of whitespace and dashes into a single dash', () => {
    expect(slugify('A   --   B')).toBe('a-b');
  });

  it('trims leading and trailing dashes', () => {
    expect(slugify('  -- hello --  ')).toBe('hello');
  });

  it('caps the slug at 80 characters', () => {
    const long = 'a'.repeat(200);
    const out = slugify(long);
    expect(out.length).toBe(80);
    expect(out).toBe('a'.repeat(80));
  });

  it('transliterates Cyrillic characters to ASCII', () => {
    expect(slugify('Кубок Армении 2026')).toBe('kubok-armenii-2026');
  });

  it('handles the multi-letter Cyrillic transliterations', () => {
    // ё → yo, ж → zh, ц → ts, ч → ch, ш → sh, щ → sch, ю → yu, я → ya
    expect(slugify('Ёжик щука чай шум юла яма цапля')).toBe('yozhik-schuka-chay-shum-yula-yama-tsaplya');
  });

  it('drops the silent Cyrillic ъ and ь', () => {
    expect(slugify('подъезд день')).toBe('podezd-den');
  });

  it('returns an empty string for empty / whitespace input', () => {
    expect(slugify('')).toBe('');
    expect(slugify('   ')).toBe('');
  });

  it('returns an empty string when input has no slug-able characters', () => {
    // Characters outside Cyrillic block and not ASCII letters/digits get
    // stripped — this is intentional for the wizard's preview UX.
    expect(slugify('!!!')).toBe('');
  });

  it('preserves digits inside the slug', () => {
    expect(slugify('Liga 2025-2026 Spring')).toBe('liga-2025-2026-spring');
  });
});
