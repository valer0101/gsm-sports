import { useLocale } from 'next-intl';
import { resolveCountry } from '@gsm/countries';
import type { Locale } from '@/i18n/config';

interface Props {
  /** Freeform country string from DB. May be ISO-2/3, localized name, alias, or junk. */
  value: string | null | undefined;
  /** When false, render only the flag (with the name in `title`). Default true. */
  showName?: boolean;
  /** Rendered when `value` is empty. Default '—'. */
  emptyFallback?: string;
  className?: string;
}

/**
 * Render `🇷🇺 Россия` from a freeform country field. When the input doesn't
 * resolve (unknown country, junk text), the raw input is shown as-is — no
 * flag — so legacy data still reads correctly.
 */
export function CountryLabel({
  value,
  showName = true,
  emptyFallback = '—',
  className,
}: Props) {
  const locale = useLocale() as Locale;
  const { flag, name, raw } = resolveCountry(value, locale);

  if (!raw) {
    return <span className={className}>{emptyFallback}</span>;
  }

  if (!flag) {
    // Unknown country — show raw text, no flag, full string in title for context.
    return (
      <span className={className} title={raw}>
        {raw}
      </span>
    );
  }

  if (!showName) {
    return (
      <span className={className} title={name ?? raw} aria-label={name ?? raw}>
        {flag}
      </span>
    );
  }

  return (
    <span className={className}>
      <span aria-hidden>{flag}</span> {name ?? raw}
    </span>
  );
}
