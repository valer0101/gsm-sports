/**
 * @gsm/countries — ISO-3166 country normalization and flag-emoji helpers.
 *
 * Three pure functions:
 *   - normalizeToIso2(input): freeform string → 'RU'-style code (or null).
 *   - iso2ToFlag(code): 'RU' → '🇷🇺' (Unicode regional-indicator pair).
 *   - iso2ToName(code, locale): 'RU' + 'hy' → 'Ռուսաստան' (or English fallback).
 *
 * The data table (./data.ts) covers ~80 sport-relevant countries — unknowns
 * return null/empty so the UI can fall back to the raw input.
 */

import { COUNTRIES, type CountryRecord } from './data';

export { COUNTRIES };
export type { CountryRecord };

/** Lowercase, trim, collapse whitespace, and strip diacritics for matching. */
function canonicalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

interface IndexEntry {
  iso2: string;
}

let LOOKUP: Map<string, IndexEntry> | null = null;

function buildLookup(): Map<string, IndexEntry> {
  const m = new Map<string, IndexEntry>();
  const add = (key: string, iso2: string): void => {
    const k = canonicalize(key);
    if (k.length === 0) return;
    if (!m.has(k)) m.set(k, { iso2 });
  };
  for (const c of COUNTRIES) {
    add(c.iso2, c.iso2);
    add(c.iso3, c.iso2);
    add(c.nameEn, c.iso2);
    add(c.nameRu, c.iso2);
    if (c.nameHy) add(c.nameHy, c.iso2);
    if (c.aliases) for (const a of c.aliases) add(a, c.iso2);
  }
  return m;
}

function getLookup(): Map<string, IndexEntry> {
  if (!LOOKUP) LOOKUP = buildLookup();
  return LOOKUP;
}

/**
 * Resolve a freeform country string to ISO-3166-1 alpha-2.
 * Tries: ISO-2 / ISO-3 / canonical name / locale name / alias.
 * Returns null when no match is found.
 */
export function normalizeToIso2(input: string | null | undefined): string | null {
  if (!input) return null;
  const key = canonicalize(input);
  if (key.length === 0) return null;
  const hit = getLookup().get(key);
  return hit ? hit.iso2 : null;
}

/**
 * Convert an ISO-3166-1 alpha-2 code to a flag emoji using Unicode regional
 * indicator symbols. Returns '' for invalid input. Accepts lowercase too.
 *
 * Note: this is purely algorithmic and works for any valid ISO-2 code, even
 * codes not present in our COUNTRIES table.
 */
export function iso2ToFlag(code: string | null | undefined): string {
  if (!code) return '';
  const trimmed = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(trimmed)) return '';
  const A = 0x41; // 'A'
  const REGIONAL_A = 0x1f1e6; // 🇦
  const cp1 = REGIONAL_A + (trimmed.charCodeAt(0) - A);
  const cp2 = REGIONAL_A + (trimmed.charCodeAt(1) - A);
  return String.fromCodePoint(cp1, cp2);
}

export type SupportedLocale = 'en' | 'ru' | 'hy';

/**
 * Localized country name. Falls back: requested locale → English.
 * Returns null when the code is unknown.
 */
export function iso2ToName(
  code: string | null | undefined,
  locale: SupportedLocale,
): string | null {
  if (!code) return null;
  const upper = code.trim().toUpperCase();
  const rec = COUNTRIES.find((c) => c.iso2 === upper);
  if (!rec) return null;
  if (locale === 'ru') return rec.nameRu;
  if (locale === 'hy') return rec.nameHy ?? rec.nameRu;
  return rec.nameEn;
}

/**
 * Convenience: resolve freeform input → flag + localized name.
 * Useful for UI components that want both pieces in one call.
 */
export function resolveCountry(
  input: string | null | undefined,
  locale: SupportedLocale,
): { iso2: string | null; flag: string; name: string | null; raw: string | null } {
  const raw = input?.trim() || null;
  const iso2 = normalizeToIso2(input);
  return {
    iso2,
    flag: iso2 ? iso2ToFlag(iso2) : '',
    name: iso2 ? iso2ToName(iso2, locale) : null,
    raw,
  };
}
