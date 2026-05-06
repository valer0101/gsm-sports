'use client';

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
  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] tracking-[0.12em] uppercase text-[var(--color-primary)] font-semibold mb-2">Step 1 of 4</div>
        <h1 className="text-3xl font-extrabold tracking-tight">Basic Information</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Identify the tournament: what, when, where.</p>
      </div>

      <Section>
        <Label>Poster</Label>
        <PosterUpload url={p.poster} onChange={p.setPoster} />
      </Section>

      <Section>
        <div>
          <Label required>Tournament name</Label>
          <input
            type="text"
            value={p.name}
            onChange={(e) => p.setName(e.target.value)}
            placeholder="e.g. Yerevan Open 2026"
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
                    Edit slug
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
          <div>
            <Label required>Sport</Label>
            <SportSelect value={p.sportId} onChange={p.setSportId} />
          </div>
          <div>
            <Label>Format</Label>
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
                    <div className="text-sm font-semibold">{f.label}</div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-0.5">{f.desc}</div>
                    {active && <div className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[var(--color-primary)]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      <Section>
        <SectionTitle>Schedule</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div>
            <Label required>Start date &amp; time</Label>
            <DateTimeInput value={p.startDate} onChange={p.setStartDate} />
          </div>
          <div>
            <Label>End date &amp; time</Label>
            <DateTimeInput value={p.endDate} onChange={p.setEndDate} />
            <Helper>Leave empty for single-day events.</Helper>
          </div>
        </div>
      </Section>

      <Section>
        <SectionTitle>Location</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <Label>Country</Label>
            <TextInput value={p.country} onChange={p.setCountry} placeholder="Armenia" icon={Icon.globe} />
          </div>
          <div>
            <Label>City</Label>
            <TextInput value={p.city} onChange={p.setCity} placeholder="Yerevan" />
          </div>
          <div>
            <Label>Venue</Label>
            <TextInput value={p.venue} onChange={p.setVenue} placeholder="Karen Demirchyan Arena" />
          </div>
        </div>
      </Section>

      <Section>
        <div className="flex items-center justify-between mb-3">
          <SectionTitle inline>Description</SectionTitle>
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
          placeholder={p.descriptionLocale === 'ru'
            ? 'Опишите турнир, регламент, условия участия...'
            : p.descriptionLocale === 'en'
            ? 'Describe the tournament, rules, participation conditions...'
            : 'Նկարագրեք մրցաշարը, կանոնակարգը, մասնակցության պայմանները...'}
          className="w-full px-4 py-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] resize-y"
        />
        <div className="flex items-center justify-between mt-2">
          <Helper>Russian is primary. EN/HY are optional but recommended.</Helper>
          <span className="text-xs text-[var(--color-text-muted)] font-mono">
            {p.description[p.descriptionLocale].length} / 2000
          </span>
        </div>
      </Section>
    </div>
  );
}
