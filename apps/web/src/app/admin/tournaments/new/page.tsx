'use client';

/**
 * Tournament Creation Wizard.
 * Spec: docs/design/admin-tournament-wizard.md
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCreateTournament } from '@/hooks/useAdmin';
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

export default function NewTournamentPage() {
  const router = useRouter();
  const createMutation = useCreateTournament();
  const { data: sports } = useSports();

  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  // Step 1
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [editingSlug, setEditingSlug] = useState(false);
  const [sportId, setSportId] = useState('');
  const [format, setFormat] = useState('double_elimination');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [venue, setVenue] = useState('');
  const [descriptionLocale, setDescriptionLocale] = useState<Locale>('ru');
  const [description, setDescription] = useState({ ru: '', en: '', hy: '' });
  const [posterUrl, setPosterUrl] = useState<string | null>(null);

  // Step 2
  const [competitionType, setCompetitionType] = useState<CompetitionType>('setka');
  const [ageGroups, setAgeGroups] = useState<Set<AgeGroup>>(new Set());
  const [hand, setHand] = useState<Hand>('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [maxParticipantsCat, setMaxParticipantsCat] = useState('');
  const [matchDuration, setMatchDuration] = useState('');
  const [tiebreaker, setTiebreaker] = useState('higher_seed');

  // Step 3
  const [categories, setCategories] = useState<WeightCat[]>([]);
  const [tolerance, setTolerance] = useState(0);
  const [genders, setGenders] = useState<Set<Gender>>(new Set(['male', 'female']));

  // Step 4
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [registrationOpenImmediately, setRegistrationOpenImmediately] = useState(true);
  const [entryFeeType, setEntryFeeType] = useState<EntryFeeType>('free');
  const [entryFeeAmount, setEntryFeeAmount] = useState('');
  const [entryFeeConditions, setEntryFeeConditions] = useState('');
  const [prizes, setPrizes] = useState<Prize[]>([]);
  const [streamUrl, setStreamUrl] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState('');

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

  const isDirty = name.trim().length > 0 || categories.length > 0 || prizes.length > 0 || posterUrl !== null;

  // Focus the step heading on every step change (a11y).
  const stepHeadingRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    stepHeadingRef.current?.focus();
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // Browser leave guard while form is dirty (close tab / refresh / back).
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  // Shake feedback on disabled-Next click.
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

  // Build the CreateTournamentDto payload from form state.
  const buildPayload = () => {
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
      ...(maxParticipantsCat && { maxParticipantsPerCategory: parseInt(maxParticipantsCat, 10) }),
      ...(matchDuration && { matchDurationSec: parseInt(matchDuration, 10) }),
      ...(tiebreaker && { tiebreaker }),
    };
    if (competitionType === 'setka' && ageGroups.size > 0) {
      sportConfig.ageGroups = Array.from(ageGroups);
    }

    return {
      sportId,
      name: name.trim(),
      // Slug is generated server-side from the name — the wizard's slug
      // preview/edit field is purely informational.
      format,
      startDate,
      endDate: endDate || undefined,
      location: venue.trim(),
      country: country.trim() || undefined,
      city: city.trim() || undefined,
      maxParticipants: maxParticipants ? parseInt(maxParticipants, 10) : undefined,
      registrationDeadline: registrationDeadline || undefined,
      descriptionRu: description.ru || undefined,
      descriptionEn: description.en || undefined,
      descriptionHy: description.hy || undefined,
      isFeatured,
      posterUrl: posterUrl || undefined,
      streamUrl: streamUrl || undefined,
      sportConfig,
      weightCategories: weightCategories.length > 0 ? weightCategories : undefined,
    };
  };

  const submit = async () => {
    setSubmitError(null);
    try {
      const payload = buildPayload();
      const created = await createMutation.mutateAsync(payload as never);
      // Open registration right after create if the toggle is on.
      if (registrationOpenImmediately && created?.id) {
        try {
          await api.patch(`/admin/tournaments/${created.id}/toggle-registration`);
        } catch {
          // Non-fatal — tournament was created. Surface a soft warning later if needed.
        }
      }
      const targetSlug = (created as { slug?: string })?.slug ?? effectiveSlug;
      router.push(targetSlug ? `/admin/tournaments/${created.id}` : '/admin');
    } catch (e: unknown) {
      const data = (e as { response?: { data?: { message?: string | string[] } } })?.response?.data;
      const msg = Array.isArray(data?.message)
        ? data?.message.join(' · ')
        : data?.message ?? 'Failed to create tournament. Try again.';
      setSubmitError(msg);
      // Scroll the error into view at the top of step 4.
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const cancel = () => {
    if (isDirty && !window.confirm('Discard changes? Your tournament won’t be saved.')) return;
    router.push('/admin');
  };

  const selectedSport = sports?.find((s) => s.id === sportId);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-background)] text-[var(--color-text-primary)]">
      {/* Top bar */}
      <header className="sticky top-0 z-30 h-14 flex items-center justify-between px-4 sm:px-6 bg-[var(--color-background)] border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={cancel}
          className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors"
        >
          {Icon.arrowLeft()}
          <span className="hidden sm:inline">Back to tournaments</span>
          <span className="sm:hidden">Back</span>
        </button>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={createMutation.isPending || !sportId || !name.trim() || !startDate || !venue.trim()}
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-[var(--color-text-secondary)] hover:text-white border border-transparent hover:border-[var(--color-border)] rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={cancel}
            className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-[var(--color-text-secondary)] hover:text-white transition-colors"
          >
            Cancel
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
          {/* Submit error banner — only on step 4 where Create lives */}
          {submitError && currentStep === 4 && (
            <div className="mb-6 px-5 py-4 bg-[var(--color-error)]/10 border border-[var(--color-error)]/40 rounded-md flex items-start gap-3">
              <div className="text-[var(--color-error)] flex-shrink-0 mt-0.5">{Icon.info('h-5 w-5')}</div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-[var(--color-error)]">Couldn&apos;t create tournament</div>
                <div className="text-xs text-[var(--color-text-secondary)] mt-1">{submitError}</div>
              </div>
              <button
                type="button"
                onClick={() => setSubmitError(null)}
                className="text-[var(--color-text-muted)] hover:text-white"
                aria-label="Dismiss"
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
            <Step3Categories
              categories={categories} setCategories={setCategories}
              tolerance={tolerance} setTolerance={setTolerance}
              genders={genders} setGenders={setGenders}
              ageGroupCount={Math.max(1, ageGroups.size)}
              handMul={hand === 'both' ? 2 : 1}
            />
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
        isSubmitting={createMutation.isPending}
      />
    </div>
  );
}
