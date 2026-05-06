'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations('tournament_wizard');
  const isSetka = p.competitionType === 'setka';
  const ageCount = p.ageGroups.size || 1;
  const handMultiplier = p.hand === 'both' ? 2 : p.hand ? 1 : 1;

  const ageLabel = (id: AgeGroup) =>
    id === 'juniors' ? t('age_juniors')
    : id === 'adults' ? t('age_adults')
    : t('age_veterans');
  const ageSubLabel = (id: AgeGroup) =>
    id === 'juniors' ? t('age_juniors_sub')
    : id === 'adults' ? t('age_adults_sub')
    : t('age_veterans_sub');

  const tiebreakerOptions = [
    { id: 'higher_seed', label: t('tiebreaker_higher_seed') },
    { id: 'coin_flip', label: t('tiebreaker_coin_flip') },
    { id: 'extra_round', label: t('tiebreaker_extra_round') },
  ];

  const toggleAge = (id: AgeGroup) => {
    const next = new Set(p.ageGroups);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    p.setAgeGroups(next);
  };

  return (
    <div className="space-y-8">
      <div>
        <div className="text-[11px] tracking-[0.12em] uppercase text-[var(--color-primary)] font-semibold mb-2">
          {t('step_label', { current: 2, total: 4 })}
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">{t('step2_title')}</h1>
        <p className="mt-2 text-[var(--color-text-secondary)]">{t('step2_subtitle')}</p>
      </div>

      <Section>
        <SectionTitle>{t('competition_type')}</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <BigChoiceCard
            active={p.competitionType === 'setka'}
            onClick={() => p.setCompetitionType('setka')}
            icon={Icon.brackets()}
            title={t('comp_setka_title')}
            subtitle={t('comp_setka_subtitle')}
            description={t('comp_setka_description')}
          />
          <BigChoiceCard
            active={p.competitionType === 'armfight'}
            onClick={() => p.setCompetitionType('armfight')}
            icon={Icon.zap()}
            title={t('comp_armfight_title')}
            subtitle={t('comp_armfight_subtitle')}
            description={t('comp_armfight_description')}
          />
        </div>
      </Section>

      {isSetka && (
        <Section>
          <SectionTitle>{t('age_groups_label')}</SectionTitle>
          <Helper>{t('age_groups_helper')}</Helper>
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
                  <span>{ageLabel(ag.id)}</span>
                  <span className={active ? 'text-white/70' : 'text-[var(--color-text-muted)]'}>· {ageSubLabel(ag.id)}</span>
                </button>
              );
            })}
          </div>
          {p.ageGroups.size === 0 && (
            <div className="mt-4 flex items-start gap-2 text-xs text-[var(--color-warning)]">
              {Icon.info('h-4 w-4 mt-0.5 flex-shrink-0')}
              <span>{t('age_groups_warning')}</span>
            </div>
          )}
        </Section>
      )}

      <Section>
        <SectionTitle>{t('hand_section')}</SectionTitle>
        <Helper>{t('hand_helper')}</Helper>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
          <HandCard active={p.hand === 'right'} onClick={() => p.setHand('right')} icon={Icon.handRight()} title={t('hand_right')} />
          <HandCard active={p.hand === 'left'} onClick={() => p.setHand('left')} icon={Icon.handLeft()} title={t('hand_left')} />
          <HandCard
            active={p.hand === 'both'}
            onClick={() => p.setHand('both')}
            icon={Icon.handBoth()}
            title={t('hand_both')}
            extraNote={t('hand_both_note')}
          />
        </div>
      </Section>

      {p.competitionType && p.hand && (
        <div className="bg-[var(--color-primary-dim)] border border-[var(--color-primary)]/40 rounded-[10px] px-5 py-4 flex items-center gap-3">
          <div className="text-[var(--color-primary)]">{Icon.info('h-5 w-5')}</div>
          <div className="text-sm text-[var(--color-text-primary)]">
            {isSetka ? (
              <>
                {t(ageCount === 1 ? 'bracket_preview_setka_one' : 'bracket_preview_setka_other', { count: ageCount })}
                {handMultiplier > 1 && t('bracket_preview_hands', { count: handMultiplier })}
                <span className="text-[var(--color-text-secondary)]">{t('bracket_preview_categories_next')}</span>
              </>
            ) : (
              <>
                {t('bracket_preview_armfight_single')}
                {handMultiplier > 1 && t('bracket_preview_armfight_both')}
                <span className="text-[var(--color-text-secondary)]">{t('bracket_preview_categories_next')}</span>
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
          {t('advanced_toggle')}
          <span className="text-[var(--color-text-muted)]">{t('advanced_optional')}</span>
        </button>

        {p.advancedOpen && (
          <Section>
            <div className="space-y-5">
              <div>
                <Label>{t('advanced_max_per_cat')}</Label>
                <input
                  type="number"
                  min="2"
                  value={p.maxParticipantsCat}
                  onChange={(e) => p.setMaxParticipantsCat(e.target.value)}
                  placeholder={t('advanced_unlimited_placeholder')}
                  className="w-full h-12 px-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] [color-scheme:dark]"
                />
                <Helper>{t('advanced_max_per_cat_helper')}</Helper>
              </div>
              <div>
                <Label>{t('advanced_match_duration')}</Label>
                <input
                  type="number"
                  min="0"
                  value={p.matchDuration}
                  onChange={(e) => p.setMatchDuration(e.target.value)}
                  placeholder={t('advanced_no_limit_placeholder')}
                  className="w-full h-12 px-4 bg-[var(--color-surface-2)] border border-[var(--color-border)] focus:border-[var(--color-primary)] focus:ring-4 focus:ring-[var(--color-primary-dim)] focus:outline-none rounded-md transition-all placeholder:text-[var(--color-text-muted)] [color-scheme:dark]"
                />
              </div>
              <div>
                <Label>{t('advanced_tiebreaker')}</Label>
                <div className="flex gap-2 flex-wrap">
                  {tiebreakerOptions.map((tb) => (
                    <button
                      key={tb.id}
                      type="button"
                      onClick={() => p.setTiebreaker(tb.id)}
                      className={[
                        'px-4 py-2.5 rounded-md border text-sm font-medium transition-all',
                        p.tiebreaker === tb.id
                          ? 'bg-[var(--color-primary-dim)] border-[var(--color-primary)] text-white'
                          : 'bg-[var(--color-surface-2)] border-[var(--color-border)] hover:border-[var(--color-border-strong)]',
                      ].join(' ')}
                    >
                      {tb.label}
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
