'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '../../_lib/icons';
import { FORMATS } from '../../_lib/constants';
import { slugify } from '../../_lib/slug';
import type { Locale } from '../../_lib/types';
import { Section, SectionTitle, Label, Helper } from '../fields/Section';
import { TextInput } from '../fields/TextInput';
import { DateTimeInput } from '../fields/DateTimeInput';
import { SportSelect } from '../fields/SportSelect';
import { PosterUpload } from '../fields/PosterUpload';

export type Step1Props = {
  name: string; setName: (v: string) => void;
  slug: string; setSlugRaw: (v: string) => void;
  editingSlug: boolean; setEditingSlug: (v: boolean) => void;
  setSlugManual: (v: boolean) => void;
  sportId: string; setSportId: (v: string) => void;
  format: string; setFormat: (v: string) => void;
  startDate: string; setStartDate: (v: string) => void;
  endDate: string; setEndDate: (v: string) => void;
  country: string; setCountry: (v: string) => void;
  city: string; setCity: (v: string) => void;
  venue: string; setVenue: (v: string) => void;
  descriptionLocale: Locale; setDescriptionLocale: (v: Locale) => void;
  description: { ru: string; en: string; hy: string };
  setDescription: (v: { ru: string; en: string; hy: string }) => void;
  poster: string | null; setPoster: (v: string | null) => void;
};

export function Step1Basic(p: Step1Props) {
  const t = useTranslations('tournament_wizard');

  // FORMATS comes from constants.ts (sport-engine values), but the visible
  // labels and descriptions live in the translation file so they localize.
  const formatLabel = (id: string): string => {
    if (id === 'single_elimination') return t('format_single_elim');
    if (id === 'double_elimination') return t('format_double_elim');
    return t('format_round_robin');
  };
  const formatDesc = (id: string): string => {
    if (id === 'single_elimination') return t('format_single_elim_desc');
    if (id === 'double_elimination') return t('format_double_elim_desc');
    return t('format_round_robin_desc');
  };

  const descriptionPlaceholder =
    p.descriptionLocale === 'ru' ? t('description_placeholder_ru')
    : p.descriptionLocale === 'en' ? t('description_placeholder_en')
    : t('description_placeholder_hy');

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] tracking-[0.12em] uppercase text-[var(--color-primary)] font-semibold mb-2">
          {t('step_label', { current: 1, total: 4 })}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t('step1_title')}</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">{t('step1_subtitle')}</p>
      </div>

      <Section>
        <Label>{t('poster_label')}</Label>
        <PosterUpload url={p.poster} onChange={p.setPoster} />
      </Section>

      <Section>
        <div>
          <Label required>{t('name_label')}</Label>
          <input
            type="text"
            value={p.name}
            onChange={(e) => p.setName(e.target.value)}
            placeholder={t('name_placeholder')}
            className="w-full h-14 px-4 text-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)]"
          />
          {p.name.trim().length > 0 && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="text-[var(--color-text-muted)] font-mono">gsm-sports.com/tournaments/</span>
              {p.editingSlug ? (
                <input
                  type="text"
                  value={p.slug}
                  onChange={(e) => { p.setSlugRaw(slugify(e.target.value)); p.setSlugManual(true); }}
                  onBlur={() => p.setEditingSlug(false)}
                  autoFocus
                  className="px-2 py-0.5 text-xs font-mono bg-[var(--color-surface-2)] border border-[var(--color-primary)] rounded outline-none"
                />
              ) : (
                <>
                  <span className="text-[var(--color-text-secondary)] font-mono">{p.slug || '...'}</span>
                  <button
                    type="button"
                    onClick={() => { p.setSlugRaw(p.slug); p.setEditingSlug(true); }}
                    className="flex items-center gap-1 text-[var(--color-primary)] hover:text-[var(--color-primary-hover)] transition-colors"
                  >
                    {Icon.pencil()}
                    {t('edit_slug')}
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          <div>
            <Label required>{t('sport_label')}</Label>
            <SportSelect value={p.sportId} onChange={p.setSportId} />
          </div>
          <div>
            <Label>{t('format_label')}</Label>
            <div className="flex gap-2 flex-wrap">
              {FORMATS.map((f) => {
                const active = p.format === f.id;
                const recommended = 'recommended' in f && f.recommended;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => p.setFormat(f.id)}
                    className={[
                      'flex-1 min-w-[140px] text-left px-4 py-3 rounded-md border transition-all relative',
                      active
                        ? 'border-[var(--color-primary)] bg-[var(--color-primary-dim)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)]',
                    ].join(' ')}
                  >
                    {recommended && (
                      <span className="absolute top-1.5 right-1.5 text-[9px] tracking-wider uppercase text-[var(--color-accent)] font-bold">★</span>
                    )}
                    <div className="text-sm font-semibold">{formatLabel(f.id)}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{formatDesc(f.id)}</div>
                    {active && <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--color-primary)]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionTitle>{t('schedule_section')}</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label required>{t('start_date_label')}</Label>
            <DateTimeInput
              value={p.startDate}
              onChange={(v) => {
                p.setStartDate(v);
                if (p.endDate && v && p.endDate <= v) p.setEndDate('');
              }}
            />
          </div>
          <div>
            <Label>{t('end_date_label')}</Label>
            <DateTimeInput
              value={p.endDate}
              onChange={p.setEndDate}
              min={p.startDate || undefined}
              disabled={!p.startDate}
              invalid={!!p.endDate && !!p.startDate && p.endDate <= p.startDate}
            />
            {p.endDate && p.startDate && p.endDate <= p.startDate ? (
              <p className="mt-1.5 text-xs text-[var(--color-error)]">{t('end_date_error')}</p>
            ) : (
              <Helper>{p.startDate ? t('end_date_helper_default') : t('end_date_helper_no_start')}</Helper>
            )}
          </div>
        </div>
      </Section>

      <Section>
        <SectionTitle>{t('location_section')}</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <Label>{t('country_label')}</Label>
            <TextInput value={p.country} onChange={p.setCountry} placeholder={t('country_placeholder')} icon={Icon.globe} />
          </div>
          <div>
            <Label>{t('city_label')}</Label>
            <TextInput value={p.city} onChange={p.setCity} placeholder={t('city_placeholder')} />
          </div>
          <div>
            <Label>{t('venue_label')}</Label>
            <TextInput value={p.venue} onChange={p.setVenue} placeholder={t('venue_placeholder')} />
          </div>
        </div>
      </Section>

      <Section>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle inline>{t('description_section')}</SectionTitle>
          <div className="flex gap-1 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md p-0.5">
            {(['ru', 'en', 'hy'] as const).map((loc) => (
              <button
                key={loc}
                type="button"
                onClick={() => p.setDescriptionLocale(loc)}
                className={[
                  'px-3 py-1 text-xs font-semibold uppercase tracking-wide rounded transition-colors',
                  p.descriptionLocale === loc ? 'bg-[var(--color-primary)] text-white' : 'text-[var(--color-text-secondary)] hover:text-white',
                ].join(' ')}
              >
                {loc}
              </button>
            ))}
          </div>
        </div>
        <textarea
          value={p.description[p.descriptionLocale]}
          onChange={(e) => p.setDescription({ ...p.description, [p.descriptionLocale]: e.target.value })}
          rows={6}
          maxLength={2000}
          placeholder={descriptionPlaceholder}
          className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] resize-y"
        />
        <div className="flex items-center justify-between mt-2">
          <Helper>{t('description_helper')}</Helper>
          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {p.description[p.descriptionLocale].length} / 2000
          </span>
        </div>
      </Section>
    </div>
  );
}
