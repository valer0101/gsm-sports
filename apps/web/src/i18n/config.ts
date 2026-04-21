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
      const [tag, ...params] = part.trim().split(';');
      const qParam = params.find((p) => p.trim().startsWith('q='));
      let q = 1;
      if (qParam) {
        const parsed = parseFloat(qParam.trim().slice(2));
        // Malformed q is treated as 0 per RFC 7231 §5.3.1.
        q = isNaN(parsed) ? 0 : parsed;
      }
      return { tag: tag.toLowerCase(), q };
    })
    .filter(({ q }) => q > 0)
    .sort((a, b) => b.q - a.q);

  for (const { tag } of parts) {
    const base = tag.split('-')[0];
    if (isLocale(base)) return base;
  }
  return null;
}
