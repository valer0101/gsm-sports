'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '../../_lib/icons';
import { PRESET_WEIGHTS } from '../../_lib/constants';
import { type Gender, type WeightCat, newCatId } from '../../_lib/types';
import { Section, SectionTitle, Label, Helper } from '../fields/Section';

export type Step3Props = {
  categories: WeightCat[];
  setCategories: (v: WeightCat[]) => void;
  tolerance: number;
  setTolerance: (v: number) => void;
  /** Which genders compete in this tournament — at least one is required. */
  genders: Set<Gender>;
  setGenders: (v: Set<Gender>) => void;
  ageGroupCount: number;
  handMul: number;
};

export function Step3Categories(p: Step3Props) {
  const t = useTranslations('tournament_wizard');
  const [customMin, setCustomMin] = useState('');
  const [customMax, setCustomMax] = useState('');
  const [customError, setCustomError] = useState('');

  const sortedCats = useMemo(() => {
    return [...p.categories].sort((a, b) => {
      const aMax = a.maxKg ?? Infinity;
      const bMax = b.maxKg ?? Infinity;
      return aMax - bMax;
    });
  }, [p.categories]);

  const genderCount = Math.max(1, p.genders.size);
  const totalBrackets = p.categories.length * genderCount * p.ageGroupCount * p.handMul;

  const toggleGender = (g: Gender) => {
    const next = new Set(p.genders);
    if (next.has(g)) {
      // Don't let the user clear both — at least one gender must compete.
      if (next.size <= 1) return;
      next.delete(g);
    } else {
      next.add(g);
    }
    p.setGenders(next);
  };

  const togglePreset = (kg: number) => {
    const existingIdx = p.categories.findIndex(
      (c) => c.maxKg === kg && c.minKg !== null && c.maxKg !== null && !c.name,
    );
    if (existingIdx >= 0) {
      p.setCategories(p.categories.filter((_, i) => i !== existingIdx));
    } else {
      const prev = [...PRESET_WEIGHTS].sort((a, b) => a - b).filter((w) => w < kg).pop();
      p.setCategories([...p.categories, { id: newCatId(), minKg: prev ?? 0, maxKg: kg }]);
    }
  };

  const isPresetSelected = (kg: number) =>
    p.categories.some((c) => c.maxKg === kg && c.minKg !== null && !c.name);

  const toggleOpenHeavyweight = () => {
    const idx = p.categories.findIndex((c) => c.maxKg === null && c.minKg !== null);
    if (idx >= 0) {
      p.setCategories(p.categories.filter((_, i) => i !== idx));
    } else {
      const highestPreset = [...PRESET_WEIGHTS].sort((a, b) => b - a)[0];
      p.setCategories([...p.categories, { id: newCatId(), minKg: highestPreset, maxKg: null }]);
    }
  };

  const hasOpenHeavyweight = p.categories.some((c) => c.maxKg === null && c.minKg !== null);

  const toggleAbsolute = () => {
    const idx = p.categories.findIndex((c) => c.minKg === null && c.maxKg === null);
    if (idx >= 0) {
      p.setCategories(p.categories.filter((_, i) => i !== idx));
    } else {
      p.setCategories([...p.categories, { id: newCatId(), minKg: null, maxKg: null, name: 'Absolute' }]);
    }
  };

  const hasAbsolute = p.categories.some((c) => c.minKg === null && c.maxKg === null);

  const addCustom = () => {
    setCustomError('');
    const min = parseFloat(customMin);
    const max = parseFloat(customMax);
    if (isNaN(min) || isNaN(max)) { setCustomError(t('weights_error_required')); return; }
    if (min >= max) { setCustomError(t('weights_error_order')); return; }
    if (min < 0 || max > 300) { setCustomError(t('weights_error_range')); return; }
    p.setCategories([...p.categories, { id: newCatId(), minKg: min, maxKg: max }]);
    setCustomMin('');
    setCustomMax('');
  };

  const removeCat = (id: string) => {
    p.setCategories(p.categories.filter((c) => c.id !== id));
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] tracking-[0.12em] uppercase text-[var(--color-primary)] font-semibold mb-2">
          {t('step_label', { current: 3, total: 4 })}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t('step3_title')}</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">{t('step3_subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Builder */}
        <div className="lg:col-span-3 space-y-6 order-2 lg:order-1">
          <Section>
            <SectionTitle>{t('weights_common_title')}</SectionTitle>
            <Helper>{t('weights_common_helper')}</Helper>
            <div className="flex flex-wrap gap-2 mt-4">
              {PRESET_WEIGHTS.map((kg) => {
                const active = isPresetSelected(kg);
                return (
                  <button
                    key={kg}
                    type="button"
                    onClick={() => togglePreset(kg)}
                    className={[
                      'px-3.5 py-2 rounded-md border font-mono text-sm font-semibold transition-all flex items-center gap-1.5',
                      active
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                    ].join(' ')}
                  >
                    {active && Icon.check('h-3 w-3')}
                    {kg} KG
                  </button>
                );
              })}
              <button
                type="button"
                onClick={toggleOpenHeavyweight}
                className={[
                  'px-3.5 py-2 rounded-md border font-mono text-sm font-semibold transition-all flex items-center gap-1.5',
                  hasOpenHeavyweight
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                ].join(' ')}
              >
                {hasOpenHeavyweight && Icon.check('h-3 w-3')}
                +110 KG
              </button>
              <button
                type="button"
                onClick={toggleAbsolute}
                title={t('weights_absolute_hint')}
                className={[
                  'px-3.5 py-2 rounded-md border font-mono text-sm font-semibold transition-all flex items-center gap-1.5',
                  hasAbsolute
                    ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                    : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                ].join(' ')}
              >
                {hasAbsolute && Icon.check('h-3 w-3')}
                {t('weights_absolute')}
              </button>
            </div>
          </Section>

          <Section>
            <SectionTitle>{t('weights_custom_title')}</SectionTitle>
            <Helper>{t('weights_custom_helper')}</Helper>
            <div className="flex flex-wrap items-end gap-3 mt-4">
              <div>
                <Label>{t('weights_min_label')}</Label>
                <input
                  type="number" min="0" max="300" step="0.5"
                  value={customMin}
                  onChange={(e) => setCustomMin(e.target.value)}
                  placeholder="60"
                  className="w-24 h-12 px-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all font-mono text-center [color-scheme:dark]"
                />
              </div>
              <div className="text-[var(--color-text-muted)] pb-3">—</div>
              <div>
                <Label>{t('weights_max_label')}</Label>
                <input
                  type="number" min="0" max="300" step="0.5"
                  value={customMax}
                  onChange={(e) => setCustomMax(e.target.value)}
                  placeholder="75"
                  className="w-24 h-12 px-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all font-mono text-center [color-scheme:dark]"
                />
              </div>
              <button
                type="button"
                onClick={addCustom}
                className="h-12 px-4 flex items-center gap-1.5 text-sm font-semibold bg-[var(--color-surface-2)] border border-[var(--color-border)] hover:border-[var(--color-primary)] hover:text-[var(--color-primary)] rounded-md transition-colors"
              >
                {Icon.plus('h-4 w-4')}
                {t('weights_add_button')}
              </button>
            </div>
            {customError && <div className="mt-2 text-xs text-[var(--color-error)]">{customError}</div>}
          </Section>

          <Section>
            <SectionTitle>{t('tolerance_title')}</SectionTitle>
            <Helper>{t('tolerance_helper')}</Helper>
            <div className="flex items-center gap-6 mt-4">
              <input
                type="range" min="0" max="5" step="0.1"
                value={p.tolerance}
                onChange={(e) => p.setTolerance(parseFloat(e.target.value))}
                className="flex-1 accent-[var(--color-primary)]"
              />
              <div className="font-mono text-2xl font-bold text-[var(--color-primary)] min-w-[80px] text-right">
                +{p.tolerance.toFixed(1)} <span className="text-sm text-[var(--color-text-secondary)]">KG</span>
              </div>
            </div>
          </Section>

          <Section>
            <SectionTitle>{t('genders_title')}</SectionTitle>
            <Helper>{t('genders_helper')}</Helper>
            <div className="flex flex-wrap gap-2 mt-4">
              {(['male', 'female'] as const).map((g) => {
                const active = p.genders.has(g);
                const isOnly = active && p.genders.size === 1;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => toggleGender(g)}
                    disabled={isOnly}
                    title={isOnly ? t('genders_min_one') : undefined}
                    className={[
                      'px-4 py-2.5 rounded-md border text-sm font-medium transition-all flex items-center gap-2 disabled:cursor-not-allowed',
                      active
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text-primary)]',
                    ].join(' ')}
                  >
                    {active && Icon.check('h-3.5 w-3.5')}
                    <span>{g === 'male' ? t('genders_men') : t('genders_women')}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        </div>

        {/* Preview */}
        <div className="lg:col-span-2 order-1 lg:order-2">
          <div className="lg:sticky lg:top-20 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-[10px] overflow-hidden">
            <div className="px-5 py-4 bg-[var(--color-surface-2)] border-b border-[var(--color-border)]">
              <div className="flex items-center gap-2 text-[var(--color-primary)]">
                {Icon.scale('h-4 w-4')}
                <span className="text-[11px] tracking-[0.12em] uppercase font-semibold">{t('preview_label')}</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-extrabold">{p.categories.length}</span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  {t(p.categories.length === 1 ? 'preview_categories_one' : 'preview_categories_other')}
                </span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                <span className="font-mono font-bold text-[var(--color-text-secondary)]">{totalBrackets}</span>{' '}
                {t(totalBrackets === 1 ? 'preview_brackets_one' : 'preview_brackets_other')}
                {totalBrackets > 32 && <span className="ml-2 text-[var(--color-warning)]">{t('preview_large_warning')}</span>}
              </div>
            </div>

            <div className="p-3 max-h-[480px] overflow-y-auto">
              {sortedCats.length === 0 ? (
                <div className="border-2 border-dashed border-[var(--color-border)] rounded-md p-8 text-center text-sm text-[var(--color-text-muted)]">
                  {t('preview_empty_line1')}<br/>{t('preview_empty_line2')}
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {sortedCats.map((c) => {
                    const isAbsolute = c.minKg === null && c.maxKg === null;
                    const isOpen = c.maxKg === null && c.minKg !== null;
                    return (
                      <li
                        key={c.id}
                        className="group flex items-center gap-3 px-3 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md hover:border-[var(--color-border-strong)] transition-colors"
                      >
                        <div className="font-mono text-base font-bold text-white min-w-[64px]">
                          {isAbsolute ? t('weights_abs_short') : isOpen ? `${c.minKg}+` : `${c.maxKg}`}
                          {!isAbsolute && (
                            <span className="text-xs font-normal text-[var(--color-text-muted)] ml-0.5">KG</span>
                          )}
                        </div>
                        <div className="flex-1 text-xs text-[var(--color-text-secondary)] font-mono">
                          {isAbsolute
                            ? t('weights_abs_label')
                            : isOpen
                              ? t('weights_over', { kg: c.minKg ?? 0 })
                              : `${c.minKg ?? 0}.0 – ${(c.maxKg as number).toFixed(1)} kg`}
                          {p.tolerance > 0 && !isAbsolute && !isOpen && (
                            <span className="text-[var(--color-text-muted)]"> (+{p.tolerance.toFixed(1)})</span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCat(c.id)}
                          className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all"
                          aria-label={t('prize_remove_reward')}
                        >
                          {Icon.trash('h-4 w-4')}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
