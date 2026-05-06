'use client';

import { Icon } from '../../_lib/icons';
import { AGE_GROUPS } from '../../_lib/constants';
import type { AgeGroup, CompetitionType, Hand } from '../../_lib/types';
import { Section, SectionTitle, Label, Helper } from '../fields/Section';
import { BigChoiceCard } from '../fields/BigChoiceCard';
import { HandCard } from '../fields/HandCard';

export type Step2Props = {
  competitionType: CompetitionType; setCompetitionType: (v: CompetitionType) => void;
  ageGroups: Set<AgeGroup>; setAgeGroups: (v: Set<AgeGroup>) => void;
  hand: Hand; setHand: (v: Hand) => void;
  advancedOpen: boolean; setAdvancedOpen: (v: boolean) => void;
  maxParticipantsCat: string; setMaxParticipantsCat: (v: string) => void;
  matchDuration: string; setMatchDuration: (v: string) => void;
  tiebreaker: string; setTiebreaker: (v: string) => void;
};

export function Step2Format(p: Step2Props) {
  const isSetka = p.competitionType === 'setka';
  const ageCount = p.ageGroups.size || 1;
  const handMultiplier = p.hand === 'both' ? 2 : p.hand ? 1 : 1;

  const toggleAge = (id: AgeGroup) => {
    const next = new Set(p.ageGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    p.setAgeGroups(next);
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] tracking-[0.12em] uppercase text-[var(--color-primary)] font-semibold mb-2">Step 2 of 4</div>
        <h1 className="text-3xl font-extrabold tracking-tight">Format Configuration</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">Set the rules of competition.</p>
      </div>

      <Section>
        <SectionTitle>Competition type</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BigChoiceCard
            active={p.competitionType === 'setka'}
            onClick={() => p.setCompetitionType('setka')}
            icon={Icon.brackets()}
            title="SETKA"
            subtitle="Bracket tournament"
            description="Multiple matches per athlete. Single or double elimination."
          />
          <BigChoiceCard
            active={p.competitionType === 'armfight'}
            onClick={() => p.setCompetitionType('armfight')}
            icon={Icon.zap()}
            title="ARMFIGHT"
            subtitle="Single match"
            description="One-off exhibition match between named athletes. Often title fights."
          />
        </div>
      </Section>

      {isSetka && (
        <Section>
          <SectionTitle>Age groups</SectionTitle>
          <Helper>Pick which age categories compete. Skip to allow all ages in one bracket.</Helper>
          <div className="flex flex-wrap gap-2 mt-4">
            {AGE_GROUPS.map((ag) => {
              const active = p.ageGroups.has(ag.id);
              return (
                <button
                  key={ag.id}
                  type="button"
                  onClick={() => toggleAge(ag.id)}
                  className={[
                    'px-4 py-2.5 rounded-md border text-sm font-medium transition-all flex items-center gap-2',
                    active
                      ? 'bg-[var(--color-primary)] border-[var(--color-primary)] text-white'
                      : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-border-strong)] text-[var(--color-text-primary)]',
                  ].join(' ')}
                >
                  {active && Icon.check('h-3.5 w-3.5')}
                  <span>{ag.label}</span>
                  <span className={active ? 'text-white/70' : 'text-[var(--color-text-muted)]'}>· {ag.sub}</span>
                </button>
              );
            })}
          </div>
          {p.ageGroups.size === 0 && (
            <div className="mt-4 flex items-start gap-2 text-xs text-[var(--color-warning)]">
              {Icon.info('h-4 w-4 mt-0.5 flex-shrink-0')}
              <span>No age groups selected — all ages will compete together in one bracket per category.</span>
            </div>
          )}
        </Section>
      )}

      <Section>
        <SectionTitle>Arm-wrestling hand</SectionTitle>
        <Helper>Which hand do athletes compete with?</Helper>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <HandCard active={p.hand === 'right'} onClick={() => p.setHand('right')} icon={Icon.handRight()} title="Right hand" />
          <HandCard active={p.hand === 'left'} onClick={() => p.setHand('left')} icon={Icon.handLeft()} title="Left hand" />
          <HandCard
            active={p.hand === 'both'}
            onClick={() => p.setHand('both')}
            icon={Icon.handBoth()}
            title="Both hands"
            extraNote="Each athlete registers for left & right separately — counts as two entries."
          />
        </div>
      </Section>

      {p.competitionType && p.hand && (
        <div className="bg-[var(--color-primary-dim)] border border-[var(--color-primary)]/40 rounded-[10px] px-5 py-4 flex items-center gap-3">
          <div className="text-[var(--color-primary)]">{Icon.info('h-5 w-5')}</div>
          <div className="text-sm text-[var(--color-text-primary)]">
            {isSetka ? (
              <>
                Will create <span className="font-mono font-bold text-[var(--color-primary)]">{ageCount}</span> bracket{ageCount > 1 ? 's' : ''} per weight category
                {handMultiplier > 1 && <> × <span className="font-mono font-bold text-[var(--color-primary)]">{handMultiplier}</span> hands</>}
                <span className="text-[var(--color-text-secondary)]"> · weight categories defined in next step.</span>
              </>
            ) : (
              <>
                Single match{handMultiplier > 1 ? ' × 2 hands' : ''} <span className="text-[var(--color-text-secondary)]">— weight categories defined in next step.</span>
              </>
            )}
          </div>
        </div>
      )}

      <div>
        <button
          type="button"
          onClick={() => p.setAdvancedOpen(!p.advancedOpen)}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors"
        >
          <span className={`transition-transform ${p.advancedOpen ? 'rotate-180' : ''}`}>{Icon.chevronDown('h-4 w-4')}</span>
          Advanced settings
          <span className="text-[var(--color-text-muted)]">— optional</span>
        </button>

        {p.advancedOpen && (
          <Section>
            <div className="space-y-5">
              <div>
                <Label>Max participants per category</Label>
                <input
                  type="number"
                  min="2"
                  value={p.maxParticipantsCat}
                  onChange={(e) => p.setMaxParticipantsCat(e.target.value)}
                  placeholder="Unlimited"
                  className="w-full h-12 px-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] [color-scheme:dark]"
                />
                <Helper>Leave blank for no cap.</Helper>
              </div>
              <div>
                <Label>Match duration limit (seconds)</Label>
                <input
                  type="number"
                  min="0"
                  value={p.matchDuration}
                  onChange={(e) => p.setMatchDuration(e.target.value)}
                  placeholder="No limit"
                  className="w-full h-12 px-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] [color-scheme:dark]"
                />
              </div>
              <div>
                <Label>Tiebreaker rule</Label>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { id: 'higher_seed', label: 'Higher seed wins' },
                    { id: 'coin_flip', label: 'Coin flip' },
                    { id: 'extra_round', label: 'Extra round' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => p.setTiebreaker(t.id)}
                      className={[
                        'px-4 py-2.5 rounded-md border text-sm font-medium transition-all',
                        p.tiebreaker === t.id
                          ? 'bg-[var(--color-primary-dim)] border-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                      ].join(' ')}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
