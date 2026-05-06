'use client';

import { useMemo, useState } from 'react';
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
    const idx = p.categories.findIndex((c) => c.maxKg === null);
    if (idx >= 0) {
      p.setCategories(p.categories.filter((_, i) => i !== idx));
    } else {
      const highestPreset = [...PRESET_WEIGHTS].sort((a, b) => b - a)[0];
      p.setCategories([...p.categories, { id: newCatId(), minKg: highestPreset, maxKg: null }]);
    }
  };

  const hasOpenHeavyweight = p.categories.some((c) => c.maxKg === null);

  const addCustom = () => {
    setCustomError('');
    const min = parseFloat(customMin);
    const max = parseFloat(customMax);
    if (isNaN(min) || isNaN(max)) { setCustomError('Both values are required.'); return; }
    if (min >= max) { setCustomError('Min must be less than max.'); return; }
    if (min < 0 || max > 300) { setCustomError('Values must be between 0 and 300 kg.'); return; }
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
        <div className="text-[11px] tracking-[0.12em] uppercase text-[var(--color-primary)] font-semibold mb-2">Step 3 of 4</div>
        <h1 className="text-3xl font-extrabold tracking-tight">Weight Categories</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Define the divisions athletes will compete in.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Builder */}
        <div className="lg:col-span-3 space-y-6 order-2 lg:order-1">
          <Section>
            <SectionTitle>Common weight classes</SectionTitle>
            <Helper>Click a preset to add or remove that class.</Helper>
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
            </div>
          </Section>

          <Section>
            <SectionTitle>Add custom range</SectionTitle>
            <Helper>For non-standard divisions like &quot;heavyweight pro&quot; (75–95 kg).</Helper>
            <div className="flex flex-wrap items-end gap-3 mt-4">
              <div>
                <Label>Min kg</Label>
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
                <Label>Max kg</Label>
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
                Add
              </button>
            </div>
            {customError && <div className="mt-2 text-xs text-[var(--color-error)]">{customError}</div>}
          </Section>

          <Section>
            <SectionTitle>Weight tolerance</SectionTitle>
            <Helper>Athletes can weigh up to this many kg over their category limit at weigh-in.</Helper>
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
            <SectionTitle>Genders competing</SectionTitle>
            <Helper>Each selected gender gets its own brackets per weight category. Uncheck to exclude a gender entirely (no brackets, no prize money).</Helper>
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
                    title={isOnly ? 'At least one gender must compete' : undefined}
                    className={[
                      'px-4 py-2.5 rounded-md border text-sm font-medium transition-all flex items-center gap-2 disabled:cursor-not-allowed',
                      active
                        ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                        : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text-primary)]',
                    ].join(' ')}
                  >
                    {active && Icon.check('h-3.5 w-3.5')}
                    <span>{g === 'male' ? 'Men' : 'Women'}</span>
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
                <span className="text-[11px] tracking-[0.12em] uppercase font-semibold">Live preview</span>
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-mono text-3xl font-extrabold">{p.categories.length}</span>
                <span className="text-sm text-[var(--color-text-secondary)]">
                  categor{p.categories.length === 1 ? 'y' : 'ies'}
                </span>
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                <span className="font-mono font-bold text-[var(--color-text-secondary)]">{totalBrackets}</span> total bracket{totalBrackets === 1 ? '' : 's'}
                {totalBrackets > 32 && <span className="ml-2 text-[var(--color-warning)]">— large tournament</span>}
              </div>
            </div>

            <div className="p-3 max-h-[480px] overflow-y-auto">
              {sortedCats.length === 0 ? (
                <div className="border-2 border-dashed border-[var(--color-border)] rounded-md p-8 text-center text-sm text-[var(--color-text-muted)]">
                  No categories yet.<br/>Add from the left.
                </div>
              ) : (
                <ul className="space-y-1.5">
                  {sortedCats.map((c) => (
                    <li
                      key={c.id}
                      className="group flex items-center gap-3 px-3 py-2.5 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md hover:border-[var(--color-border-strong)] transition-colors"
                    >
                      <div className="font-mono text-base font-bold text-white min-w-[64px]">
                        {c.maxKg === null ? `${c.minKg}+` : `${c.maxKg}`}
                        <span className="text-xs font-normal text-[var(--color-text-muted)] ml-0.5">KG</span>
                      </div>
                      <div className="flex-1 text-xs text-[var(--color-text-secondary)] font-mono">
                        {c.maxKg === null ? `over ${c.minKg} kg` : `${c.minKg ?? 0}.0 – ${c.maxKg.toFixed(1)} kg`}
                        {p.tolerance > 0 && c.maxKg !== null && (
                          <span className="text-[var(--color-text-muted)]"> (+{p.tolerance.toFixed(1)})</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeCat(c.id)}
                        className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-all"
                        aria-label="Remove category"
                      >
                        {Icon.trash('h-4 w-4')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
