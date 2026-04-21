'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { LOCALES, LOCALE_COOKIE, LOCALE_COOKIE_MAX_AGE, type Locale } from '@/i18n/config';

const LABELS: Record<Locale, { short: string; full: string }> = {
  ru: { short: 'RU', full: 'Русский' },
  en: { short: 'EN', full: 'English' },
  hy: { short: 'HY', full: 'Հայերեն' },
};

export function LocaleSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selectLocale = (next: Locale) => {
    if (next === locale) {
      setOpen(false);
      return;
    }
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
    setOpen(false);
    router.refresh();
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-sm font-medium px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {LABELS[locale]?.short ?? locale.toUpperCase()}
      </button>
      {open && (
        <ul
          role="listbox"
          className="absolute right-0 mt-2 w-40 rounded-lg border border-white/10 shadow-lg overflow-hidden z-50"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          {LOCALES.map((code) => (
            <li key={code}>
              <button
                type="button"
                role="option"
                aria-selected={code === locale}
                onClick={() => selectLocale(code)}
                className="w-full text-left px-3 py-2 text-sm transition-colors hover:bg-white/10"
                style={{
                  color: code === locale ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                }}
              >
                {LABELS[code].full}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
