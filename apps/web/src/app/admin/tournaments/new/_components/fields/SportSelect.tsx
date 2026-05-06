'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../../_lib/icons';
import { useSports, pickSportName, pickSportEmoji } from '../../_lib/hooks';

export function SportSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const t = useTranslations('tournament_wizard');
  const [open, setOpen] = useState(false);
  const { data: sports, isLoading, error, refetch } = useSports();
  const selected = sports?.find((s) => s.id === value);

  const triggerLabel = isLoading
    ? t('sport_loading')
    : error
    ? t('sport_error')
    : selected
    ? null
    : sports && sports.length === 0
    ? t('sport_empty')
    : t('sport_placeholder');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          if (error) { refetch(); return; }
          setOpen((v) => !v);
        }}
        disabled={isLoading || (!!sports && sports.length === 0 && !error)}
        className={[
          'w-full h-12 px-4 flex items-center justify-between bg-[var(--color-surface-2)] border focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all',
          error
            ? 'border-[var(--color-error)] hover:border-[var(--color-error)]'
            : 'border-[var(--color-border)] hover:border-[var(--color-border-strong)] focus:border-[var(--color-primary)]',
          'disabled:opacity-60 disabled:cursor-not-allowed',
        ].join(' ')}
      >
        <span className={selected ? 'text-white' : error ? 'text-[var(--color-error)]' : 'text-[var(--color-text-muted)]'}>
          {selected ? (
            <>
              <span className="mr-2">{pickSportEmoji(selected.slug)}</span>
              {pickSportName(selected)}
            </>
          ) : (
            triggerLabel
          )}
        </span>
        <span className="text-[var(--color-text-muted)]">{Icon.chevronDown()}</span>
      </button>
      {open && sports && sports.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute z-20 mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border-strong)] rounded-md shadow-2xl overflow-hidden max-h-72 overflow-y-auto">
            {sports.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => { onChange(s.id); setOpen(false); }}
                className={[
                  'w-full px-4 py-2.5 text-left flex items-center gap-3 text-sm transition-colors',
                  s.id === value ? 'bg-[var(--color-primary-dim)] text-white' : 'hover:bg-[var(--color-surface-2)]',
                ].join(' ')}
              >
                <span className="text-lg">{pickSportEmoji(s.slug)}</span>
                <span>{pickSportName(s)}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
