'use client';

/**
 * Tournament Wizard — shared between create (`/admin/tournaments/new`) and
 * edit (`/admin/tournaments/[id]/edit`) routes.
 *
 * The wizard owns its form state, navigation, validation, dirty-guard and
 * submit-error UI. The caller provides `mode`, optional `initialData` to
 * pre-seed state, an `onSubmit` that receives the built payload, and an
 * optional `onCancel`. Routing and mutation hooks live in the route page.
 *
 * Spec: docs/design/admin-tournament-wizard.md
 * Edit-flow decision: docs/design/00-DESIGN-SYSTEM.md §7
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Icon } from './_lib/icons';
import { slugify } from './_lib/slug';
import { useSports, pickSportName, pickSportEmoji } from './_lib/hooks';
import type {
  AgeGroup, CompetitionType, EntryFeeType, Gender, Hand, Locale, Prize, WeightCat,
} from './_lib/types';
import { WizardProgress } from './_components/WizardProgress';
import { WizardFooter } from './_components/WizardFooter';
import { Step1Basic } from './_components/steps/Step1Basic';
import { Step2Format } from './_components/steps/Step2Format';
import { Step3Categories } from './_components/steps/Step3Categories';
import { Step4Registration } from './_components/steps/Step4Registration';

export type TournamentWizardMode = 'create' | 'edit';

export interface TournamentWizardInitialData {
  name?: string;
  slug?: string;
  sportId?: string;
  format?: string;
  startDate?: string;
  endDate?: string;
  country?: string;
  city?: string;
  venue?: string;
  description?: { ru?: string; en?: string; hy?: string };
  posterUrl?: string | null;
  competitionType?: CompetitionType;
  ageGroups?: AgeGroup[];
  hand?: Hand;
  maxParticipantsPerCategory?: string;
  matchDurationSec?: string;
  tiebreaker?: string;
  categories?: WeightCat[];
  weightToleranceKg?: number;
  genders?: Gender[];
  registrationDeadline?: string;
  registrationOpenImmediately?: boolean;
  entryFeeType?: EntryFeeType;
  entryFeeAmount?: string;
  entryFeeConditions?: string;
  prizes?: Prize[];
  streamUrl?: string;
  isFeatured?: boolean;
  maxParticipants?: string;
}

export type TournamentWizardPayload = {
  sportId: string;
  name: string;
  startDate: string;
  endDate?: string;
  location: string;
  country?: string;
  city?: string;
  maxParticipants?: number;
  registrationDeadline?: string;
  descriptionRu?: string;
  descriptionEn?: string;
  descriptionHy?: string;
  isFeatured: boolean;
  posterUrl?: string;
  streamUrl?: string;
  sportConfig: Record<string, unknown>;
  weightCategories?: Array<{
    name: string;
    minWeight: number | null;
    maxWeight: number | null;
    weightToleranceKg: number;
    sortOrder: number;
    gender: Gender;
  }>;
};

export interface TournamentWizardProps {
  mode: TournamentWizardMode;
  initialData?: TournamentWizardInitialData;
  onSubmit: (
    payload: TournamentWizardPayload,
    extras: { registrationOpenImmediately: boolean },
  ) => Promise<void>;
  onCancel?: () => void;
  isSubmitting?: boolean;
}

export function TournamentWizard({
  mode,
  initialData,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: TournamentWizardProps) {
  const t = useTranslations('tournament_wizard');
  const router = useRouter();
  const { data: sports } = useSports();

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1
  const [name, setName] = useState(initialData?.name ?? '');
  const [slug, setSlug] = useState(initialData?.slug ?? '');
  // In edit mode the slug is already chosen — treat it as a manual override
  // so it isn't replaced by `slugify(name)`.
  const [slugManual, setSlugManual] = useState(
    mode === 'edit' || !!initialData?.slug,
  );
  const [editingSlug, setEditingSlug] = useState(false);
  const [sportId, setSportId] = useState(initialData?.sportId ?? '');
  const [format, setFormat] = useState(initialData?.format ?? 'double_elimination');
  const [startDate, setStartDate] = useState(initialData?.startDate ?? '');
  const [endDate, setEndDate] = useState(initialData?.endDate ?? '');
  const [country, setCountry] = useState(initialData?.country ?? '');
  const [city, setCity] = useState(initialData?.city ?? '');
  const [venue, setVenue] = useState(initialData?.venue ?? '');
  const [descriptionLocale, setDescriptionLocale] = useState<Locale>('ru');
  const [description, setDescription] = useState({
    ru: initialData?.description?.ru ?? '',
    en: initialData?.description?.en ?? '',
    hy: initialData?.description?.hy ?? '',
  });
  const [posterUrl, setPosterUrl] = useState<string | null>(initialData?.posterUrl ?? null);

  // Step 2
  const [competitionType, setCompetitionType] = useState<CompetitionType>(
    initialData?.competitionType ?? 'setka',
  );
  const [ageGroups, setAgeGroups] = useState<Set<AgeGroup>>(
    new Set(initialData?.ageGroups ?? []),
  );
  const [hand, setHand] = useState<Hand>(initialData?.hand ?? '');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [maxParticipantsCat, setMaxParticipantsCat] = useState(initialData?.maxParticipantsPerCategory ?? '');
  const [matchDuration, setMatchDuration] = useState(initialData?.matchDurationSec ?? '');
  const [tiebreaker, setTiebreaker] = useState(initialData?.tiebreaker ?? 'higher_seed');

  // Step 3
  const [categories, setCategories] = useState<WeightCat[]>(initialData?.categories ?? []);
  const [tolerance, setTolerance] = useState(initialData?.weightToleranceKg ?? 0);
  const [genders, setGenders] = useState<Set<Gender>>(
    new Set(initialData?.genders ?? ['male', 'female']),
  );

  // Step 4
  const [registrationDeadline, setRegistrationDeadline] = useState(initialData?.registrationDeadline ?? '');
  const [registrationOpenImmediately, setRegistrationOpenImmediately] = useState(
    initialData?.registrationOpenImmediately ?? true,
  );
  const [entryFeeType, setEntryFeeType] = useState<EntryFeeType>(initialData?.entryFeeType ?? 'free');
  const [entryFeeAmount, setEntryFeeAmount] = useState(initialData?.entryFeeAmount ?? '');
  const [entryFeeConditions, setEntryFeeConditions] = useState(initialData?.entryFeeConditions ?? '');
  const [prizes, setPrizes] = useState<Prize[]>(initialData?.prizes ?? []);
  const [streamUrl, setStreamUrl] = useState(initialData?.streamUrl ?? '');
  const [isFeatured, setIsFeatured] = useState(initialData?.isFeatured ?? false);
  const [maxParticipants, setMaxParticipants] = useState(initialData?.maxParticipants ?? '');

  const [submitError, setSubmitError] = useState<string | null>(null);

  const autoSlug = useMemo(() => slugify(name), [name]);
  const effectiveSlug = slugManual ? slug : autoSlug;

  const endBeforeStart = !!endDate && !!startDate && endDate <= startDate;

  const canAdvance = (() => {
    if (currentStep === 1) {
      return name.trim().length >= 3
        && !!sportId
        && !!startDate
        && !!venue.trim()
        && !endBeforeStart;
    }
    if (currentStep === 2) return !!competitionType && !!hand;
    if (currentStep === 3) return categories.length >= 1;
    return true;
  })();

  // In edit mode the form is "dirty" the moment it loads (it has data).
  // We still want the leave-guard to fire, so use the same flag for both.
  const isDirty = mode === 'edit'
    || name.trim().length > 0
    || categories.length > 0
    || prizes.length > 0
    || posterUrl !== null;

  const stepHeadingRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    stepHeadingRef.current?.focus();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const [shake, setShake] = useState(false);
  const triggerShake = () => {
    setShake(false);
    requestAnimationFrame(() => setShake(true));
    setTimeout(() => setShake(false), 320);
  };

  const goNext = () => {
    if (!canAdvance) { triggerShake(); return; }
    setCompletedSteps((prev) => new Set(prev).add(currentStep));
    setCurrentStep((s) => Math.min(s + 1, 4));
  };
  const goPrev = () => setCurrentStep((s) => Math.max(s - 1, 1));

  const buildPayload = (): TournamentWizardPayload => {
    const activeGenders = Array.from(genders);
    const weightCategories = categories.flatMap((c, idx) => {
      const baseName = c.name || (c.maxKg === null ? `${c.minKg}+` : `${c.maxKg}`);
      const base = {
        name: baseName,
        minWeight: c.minKg,
        maxWeight: c.maxKg,
        weightToleranceKg: tolerance,
        sortOrder: idx,
      };
      return activeGenders.map((g) => ({ ...base, gender: g }));
    });

    const sportConfig: Record<string, unknown> = {
      competitionType,
      hands: hand === 'both' ? ['right', 'left'] : [hand],
      entryFee: {
        type: entryFeeType,
        amount: entryFeeType === 'paid' && entryFeeAmount ? parseFloat(entryFeeAmount) : null,
        description: entryFeeConditions || null,
      },
      prizes: prizes.map(({ id: _id, ...rest }) => rest),
      ...(format && { format }),
      ...(maxParticipantsCat && { maxParticipantsPerCategory: parseInt(String(maxParticipantsCat), 10) }),
      ...(matchDuration && { matchDurationSec: parseInt(String(matchDuration), 10) }),
      ...(tiebreaker && { tiebreaker }),
    };
    if (competitionType === 'setka' && ageGroups.size > 0) {
      sportConfig.ageGroups = Array.from(ageGroups);
    }

    // In edit mode the backend silently strips `weightCategories` from the
    // PATCH payload (apps/api/src/admin/admin.service.ts:124) so emit it
    // only on create. Keeping it would just inflate the request.
    const includeWeightCategories = mode === 'create' && weightCategories.length > 0;

    return {
      sportId,
      name: name.trim(),
      startDate,
      endDate: endDate || undefined,
      location: venue.trim(),
      country: country.trim() || undefined,
      city: city.trim() || undefined,
      maxParticipants: maxParticipants ? parseInt(String(maxParticipants), 10) : undefined,
      registrationDeadline: registrationDeadline || undefined,
      descriptionRu: description.ru || undefined,
      descriptionEn: description.en || undefined,
      descriptionHy: description.hy || undefined,
      isFeatured,
      posterUrl: posterUrl || undefined,
      streamUrl: streamUrl || undefined,
      sportConfig,
      weightCategories: includeWeightCategories ? weightCategories : undefined,
    };
  };

  const submit = async () => {
    setSubmitError(null);
    try {
      await onSubmit(buildPayload(), { registrationOpenImmediately });
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data;
      const msg = Array.isArray(data?.message)
        ? data?.message.join(' · ')
        : data?.message ?? t('submit_error_default');
      setSubmitError(msg);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancel = () => {
    if (isDirty && !window.confirm(t('discard_confirm'))) return;
    if (onCancel) onCancel();
    else router.push('/admin');
  };

  const selectedSport = sports?.find((s) => s.id === sportId);

  // Header "save" button: in create mode this is a draft save (same submit
  // path); in edit mode it's the only commit action and reads "Save".
  const saveLabel = mode === 'edit' ? t('save_changes') : t('save_draft');
  const canHeaderSubmit = !isSubmitting && !!sportId && !!name.trim() && !!startDate && !!venue.trim();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-text-primary)]">
      <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 sm:px-6 bg-[var(--color-background)] border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={cancel}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors"
        >
          {Icon.arrowLeft()}
          <span className="hidden sm:inline">{t('back_full')}</span>
          <span className="sm:hidden">{t('back')}</span>
        </button>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={!canHeaderSubmit}
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-[var(--color-text-secondary)] hover:text-white border border-transparent hover:border-[var(--color-border)] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveLabel}
          </button>
          <button
            type="button"
            onClick={cancel}
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors"
          >
            {t('cancel')}
          </button>
        </div>
      </header>

      <WizardProgress currentStep={currentStep} completedSteps={completedSteps} onJump={(n) => setCurrentStep(n)} />

      <main className="flex-1 py-8 sm:py-10 px-4 sm:px-6">
        <div
          key={currentStep}
          ref={stepHeadingRef}
          tabIndex={-1}
          aria-live="polite"
          className={[
            'wizard-step-in outline-none',
            shake ? 'wizard-shake' : '',
            currentStep === 3 ? 'max-w-6xl' : 'max-w-3xl',
            'mx-auto',
          ].join(' ')}
        >
          {submitError && currentStep === 4 && (
            <div className="mb-6 px-5 py-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/40 rounded-md flex items-start gap-3">
              <div className="text-[var(--color-error)] flex-shrink-0 mt-0.5">{Icon.info('h-5 w-5')}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-[var(--color-error)]">{t('submit_error_title')}</div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">{submitError}</div>
              </div>
              <button
                type="button"
                onClick={() => setSubmitError(null)}
                className="text-[var(--color-text-muted)] hover:text-white"
                aria-label={t('cancel')}
              >
                {Icon.x()}
              </button>
            </div>
          )}

          {currentStep === 1 && (
            <Step1Basic
              name={name} setName={setName}
              slug={effectiveSlug} setSlugRaw={setSlug}
              editingSlug={editingSlug} setEditingSlug={setEditingSlug}
              setSlugManual={setSlugManual}
              sportId={sportId} setSportId={setSportId}
              format={format} setFormat={setFormat}
              startDate={startDate} setStartDate={setStartDate}
              endDate={endDate} setEndDate={setEndDate}
              country={country} setCountry={setCountry}
              city={city} setCity={setCity}
              venue={venue} setVenue={setVenue}
              descriptionLocale={descriptionLocale} setDescriptionLocale={setDescriptionLocale}
              description={description} setDescription={setDescription}
              poster={posterUrl} setPoster={setPosterUrl}
            />
          )}
          {currentStep === 2 && (
            <Step2Format
              competitionType={competitionType} setCompetitionType={setCompetitionType}
              ageGroups={ageGroups} setAgeGroups={setAgeGroups}
              hand={hand} setHand={setHand}
              advancedOpen={advancedOpen} setAdvancedOpen={setAdvancedOpen}
              maxParticipantsCat={maxParticipantsCat} setMaxParticipantsCat={setMaxParticipantsCat}
              matchDuration={matchDuration} setMatchDuration={setMatchDuration}
              tiebreaker={tiebreaker} setTiebreaker={setTiebreaker}
            />
          )}
          {currentStep === 3 && (
            mode === 'edit' ? (
              <>
                <div
                  role="status"
                  className="mb-6 px-5 py-4 bg-[var(--color-warning)]/10 border border-[var(--color-warning)]/40 rounded-md flex items-start gap-3"
                >
                  <div className="text-[var(--color-warning)] flex-shrink-0 mt-0.5">{Icon.info('h-5 w-5')}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-[var(--color-warning)]">
                      {t('categories_locked_title')}
                    </div>
                    <div className="text-xs text-[var(--color-text-secondary)] mt-1">
                      {t('categories_locked_body')}
                    </div>
                  </div>
                </div>
                <fieldset disabled className="contents">
                  <Step3Categories
                    categories={categories} setCategories={setCategories}
                    tolerance={tolerance} setTolerance={setTolerance}
                    genders={genders} setGenders={setGenders}
                    ageGroupCount={Math.max(1, ageGroups.size)}
                    handMul={hand === 'both' ? 2 : 1}
                  />
                </fieldset>
              </>
            ) : (
              <Step3Categories
                categories={categories} setCategories={setCategories}
                tolerance={tolerance} setTolerance={setTolerance}
                genders={genders} setGenders={setGenders}
                ageGroupCount={Math.max(1, ageGroups.size)}
                handMul={hand === 'both' ? 2 : 1}
              />
            )
          )}
          {currentStep === 4 && (
            <Step4Registration
              registrationDeadline={registrationDeadline} setRegistrationDeadline={setRegistrationDeadline}
              registrationOpenImmediately={registrationOpenImmediately} setRegistrationOpenImmediately={setRegistrationOpenImmediately}
              entryFeeType={entryFeeType} setEntryFeeType={setEntryFeeType}
              entryFeeAmount={entryFeeAmount} setEntryFeeAmount={setEntryFeeAmount}
              entryFeeConditions={entryFeeConditions} setEntryFeeConditions={setEntryFeeConditions}
              prizes={prizes} setPrizes={setPrizes}
              streamUrl={streamUrl} setStreamUrl={setStreamUrl}
              isFeatured={isFeatured} setIsFeatured={setIsFeatured}
              maxParticipants={maxParticipants} setMaxParticipants={setMaxParticipants}
              ageGroups={ageGroups}
              categories={categories}
              handMul={hand === 'both' ? 2 : 1}
              genderCount={Math.max(1, genders.size)}
              review={{
                name,
                poster: posterUrl,
                sportName: pickSportName(selectedSport),
                sportEmoji: pickSportEmoji(selectedSport?.slug),
                competitionType,
                format,
                startDate,
                endDate,
                country,
                city,
                venue,
                ageGroupCount: ageGroups.size,
                hand,
                categoryCount: categories.length,
              }}
              goToStep={(n) => setCurrentStep(n)}
            />
          )}
        </div>
      </main>

      <WizardFooter
        currentStep={currentStep}
        canAdvance={canAdvance}
        onPrev={goPrev}
        onNext={goNext}
        onSubmit={submit}
        isSubmitting={isSubmitting}
        mode={mode}
      />
    </div>
  );
}
