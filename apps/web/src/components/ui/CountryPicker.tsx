'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  COUNTRIES,
  iso2ToFlag,
  iso2ToName,
  normalizeToIso2,
  resolveCountry,
  type CountryRecord,
} from '@gsm/countries';
import type { Locale } from '@/i18n/config';

interface Props {
  /** Current value — can be ISO-2 code, freeform legacy text, or empty. */
  value: string | null | undefined;
  /**
   * Called with the new value: ISO-2 code on selection, '' on clear, or the
   * raw search string when `allowFreeText` is true and the user hits Enter
   * on a no-match query.
   */
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  /** Allow keeping a freeform text value when the picker has no match. Default false. */
  allowFreeText?: boolean;
  id?: string;
  disabled?: boolean;
}

/**
 * Searchable country combobox. Stores ISO-2 codes on selection so new data is
 * normalized at write time; legacy freeform values still display correctly via
 * `resolveCountry` and remain unchanged until the user re-picks.
 */
export function CountryPicker({
  value,
  onChange,
  placeholder,
  className,
  allowFreeText = false,
  id,
  disabled = false,
}: Props) {
  const t = useTranslations('country_picker');
  const locale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const resolved = resolveCountry(value, locale);

  // Click-outside + escape close.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Focus search input when opened.
  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const filtered = useMemo(() => filterCountries(COUNTRIES, query, locale), [query, locale]);

  const commit = (next: string): void => {
    onChange(next);
    setOpen(false);
  };

  const handleSelect = (rec: CountryRecord): void => {
    commit(rec.iso2);
  };

  const handleInputKey = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const pick = filtered[activeIdx];
      if (pick) {
        handleSelect(pick);
      } else if (allowFreeText && query.trim()) {
        // No match — store the raw query so unusual countries (small islands,
        // disputed territories) aren't blocked. Display layer falls back to raw.
        const iso = normalizeToIso2(query);
        commit(iso ?? query.trim());
      }
    }
  };

  const buttonLabel = resolved.name ?? resolved.raw ?? (placeholder ?? t('placeholder'));

  // The trigger is a div+role="button" rather than a real <button>, so the
  // inline clear control can be a true <button> child without producing
  // invalid button-in-button HTML (Firefox re-parents that and the inner
  // click never fires). Keyboard support is preserved via onKeyDown.
  const handleTriggerKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    if (disabled) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };

  return (
    <div ref={rootRef} className={`relative ${className ?? ''}`}>
      <div
        role="button"
        id={id}
        tabIndex={disabled ? -1 : 0}
        onClick={() => !disabled && setOpen((o) => !o)}
        onKeyDown={handleTriggerKey}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg bg-white/5 border border-white/10 text-sm text-white text-left hover:border-white/20 cursor-pointer ${
          disabled ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-disabled={disabled || undefined}
        aria-label={buttonLabel}
      >
        <span className="truncate">
          {resolved.raw ? (
            <>
              {resolved.flag && <span aria-hidden>{resolved.flag}</span>}
              {resolved.flag && ' '}
              {resolved.name ?? resolved.raw}
            </>
          ) : (
            <span className="text-white/40">{placeholder ?? t('placeholder')}</span>
          )}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {resolved.raw && !disabled && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                commit('');
              }}
              className="text-white/40 hover:text-white/80 px-1"
              aria-label={t('clear')}
              tabIndex={-1}
            >
              ×
            </button>
          )}
          <svg
            className={`w-4 h-4 text-white/40 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </div>

      {open && (
        <div
          className="absolute z-50 mt-1 w-full rounded-lg border border-white/15 shadow-2xl overflow-hidden bg-[var(--color-secondary)]"
        >
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={handleInputKey}
            placeholder={t('search')}
            className="w-full px-3 py-2 text-sm bg-white/5 border-b border-white/10 text-white placeholder:text-white/30 focus:outline-none"
          />
          <ul role="listbox" className="max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-3 py-3 text-sm text-white/40 text-center">
                {allowFreeText && query.trim()
                  ? t('press_enter_to_keep', { value: query.trim() })
                  : t('no_results')}
              </li>
            ) : (
              filtered.map((rec, idx) => {
                const isActive = idx === activeIdx;
                const name = iso2ToName(rec.iso2, locale) ?? rec.nameEn;
                return (
                  <li
                    key={rec.iso2}
                    role="option"
                    aria-selected={resolved.iso2 === rec.iso2}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => handleSelect(rec)}
                    className={`px-3 py-2 text-sm cursor-pointer flex items-center gap-2 ${
                      isActive ? 'bg-white/10 text-white' : 'text-white/80'
                    }`}
                  >
                    <span aria-hidden className="shrink-0">
                      {iso2ToFlag(rec.iso2)}
                    </span>
                    <span className="truncate">{name}</span>
                    <span className="ml-auto text-xs text-white/30 font-mono shrink-0">
                      {rec.iso2}
                    </span>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function filterCountries(
  list: ReadonlyArray<CountryRecord>,
  query: string,
  locale: Locale,
): CountryRecord[] {
  const q = query
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

  const sorted = [...list].sort((a, b) => {
    const an = iso2ToName(a.iso2, locale) ?? a.nameEn;
    const bn = iso2ToName(b.iso2, locale) ?? b.nameEn;
    return an.localeCompare(bn, locale);
  });

  if (!q) return sorted;

  return sorted.filter((rec) => {
    const haystack = [
      rec.iso2,
      rec.iso3,
      rec.nameEn,
      rec.nameRu,
      rec.nameHy ?? '',
      ...(rec.aliases ?? []),
    ]
      .join('|')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase();
    return haystack.includes(q);
  });
}
