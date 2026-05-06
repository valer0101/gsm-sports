'use client';

import { useTranslations } from 'next-intl';
import { Icon } from '../_lib/icons';

export function WizardFooter({
  currentStep,
  canAdvance,
  onPrev,
  onNext,
  onSubmit,
  isSubmitting = false,
}: {
  currentStep: number;
  canAdvance: boolean;
  onPrev: () => void;
  onNext: () => void;
  onSubmit?: () => void;
  isSubmitting?: boolean;
}) {
  const t = useTranslations('tournament_wizard');

  const nextStepLabel: Record<number, string> = {
    1: t('progress_format'),
    2: t('progress_categories'),
    3: t('progress_registration'),
  };

  return (
    <footer className="sticky bottom-0 z-30 py-3 sm:py-4 px-4 sm:px-6 bg-[var(--color-background)] border-t border-[var(--color-border)]">
      <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
        {currentStep > 1 ? (
          <button
            type="button"
            onClick={onPrev}
            className="flex items-center gap-2 px-3 sm:px-4 py-2.5 text-sm text-[var(--color-text-secondary)] hover:text-white border border-[var(--color-border)] hover:border-[var(--color-border-strong)] rounded-md transition-colors"
          >
            {Icon.arrowLeft()}
            <span className="hidden sm:inline">{t('footer_previous')}</span>
          </button>
        ) : (
          <div />
        )}
        {currentStep < 4 ? (
          <button
            type="button"
            onClick={onNext}
            aria-disabled={!canAdvance}
            className={[
              'flex items-center gap-2 px-4 sm:px-5 py-2.5 text-sm font-semibold text-white rounded-md transition-all',
              canAdvance
                ? 'bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)]'
                : 'bg-[var(--color-primary)]/50 cursor-not-allowed',
            ].join(' ')}
          >
            <span className="hidden sm:inline">
              {t('footer_next_with_step', { step: nextStepLabel[currentStep] ?? '' })}
            </span>
            <span className="sm:hidden">{t('footer_next')}</span>
            {Icon.arrowRight()}
          </button>
        ) : (
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-4 sm:px-6 py-2.5 text-sm font-bold bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md transition-colors flex-shrink-0 flex items-center gap-2"
          >
            {isSubmitting && <span className="h-3 w-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />}
            <span className="hidden sm:inline">{isSubmitting ? t('footer_creating') : t('footer_create')}</span>
            <span className="sm:hidden">{isSubmitting ? t('footer_creating') : t('footer_create_short')}</span>
          </button>
        )}
      </div>
    </footer>
  );
}
