export const LOCALES = ['ru', 'en', 'hy'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'hy';
export const LOCALE_COOKIE = 'gsm_lang';
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

export function pickLocaleFromAcceptLanguage(header: string | null | undefined): Locale | null {
  if (!header) return null;
  const parts = header
    .split(',')
    .map((part) => {
      const [tag, qPart] = part.trim().split(';');
      const q = qPart?.startsWith('q=') ? parseFloat(qPart.slice(2)) : 1;
      return { tag: tag.toLowerCase(), q: isNaN(q) ? 1 : q };
    })
    .sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }
  return null;
}
