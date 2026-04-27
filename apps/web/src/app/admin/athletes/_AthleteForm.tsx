'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { CountryPicker } from '@/components/ui/CountryPicker';
import { useSports, type AthletePayload } from '@/hooks/useAthletes';
import type { Athlete } from '@/types/api';

const athleteSchema = z.object({
  sportId: z.string().min(1, 'Required'),
  firstName: z.string().min(1, 'Required'),
  lastName: z.string().min(1, 'Required'),
  country: z.string().optional(),
  city: z.string().optional(),
  gender: z.string().optional(),
  primaryHand: z.string().optional(),
  weight: z.string().optional(),
  height: z.string().optional(),
  experienceLevel: z.string().optional(),
  photoUrl: z.string().optional(),
  bioRu: z.string().optional(),
});

type AthleteFormValues = z.infer<typeof athleteSchema>;

interface Props {
  initial?: Athlete;
  onSubmit: (data: AthletePayload) => void;
  isPending: boolean;
  isError: boolean;
  error?: unknown;
}

const FIELD_CLASS =
  'w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors text-sm';
const SELECT_CLASS = `${FIELD_CLASS} bg-[var(--color-secondary)]`;

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-xs font-semibold uppercase tracking-wider mb-2 text-[var(--color-text-secondary)]">
      {children}
    </label>
  );
}

export function AthleteForm({ initial, onSubmit, isPending, isError, error }: Props) {
  const t = useTranslations('admin_athletes');
  const tCommon = useTranslations('common');
  const { data: sports } = useSports();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<AthleteFormValues>({
    resolver: zodResolver(athleteSchema),
    defaultValues: {
      sportId: initial?.sport?.id ?? '',
      firstName: initial?.firstName ?? '',
      lastName: initial?.lastName ?? '',
      country: initial?.country ?? '',
      city: initial?.city ?? '',
      gender: initial?.gender ?? '',
      primaryHand: initial?.primaryHand ?? '',
      weight: initial?.weight ? String(initial.weight) : '',
      height: initial?.height ? String(initial.height) : '',
      experienceLevel: initial?.experienceLevel ?? '',
      photoUrl: initial?.photoUrl ?? '',
      bioRu: (initial as any)?.bioRu ?? '',
    },
  });

  useEffect(() => {
    if (initial) {
      reset({
        sportId: initial.sport?.id ?? '',
        firstName: initial.firstName,
        lastName: initial.lastName,
        country: initial.country ?? '',
        city: initial.city ?? '',
        gender: initial.gender ?? '',
        primaryHand: initial.primaryHand ?? '',
        weight: initial.weight ? String(initial.weight) : '',
        height: initial.height ? String(initial.height) : '',
        experienceLevel: initial.experienceLevel ?? '',
        photoUrl: initial.photoUrl ?? '',
        bioRu: (initial as any)?.bioRu ?? '',
      });
    }
  }, [initial, reset]);

  const photoUrl = watch('photoUrl');

  const onValid = (values: AthleteFormValues) => {
    onSubmit({
      sportId: values.sportId,
      firstName: values.firstName,
      lastName: values.lastName,
      country: values.country || undefined,
      city: values.city || undefined,
      gender: values.gender || undefined,
      primaryHand: values.primaryHand || undefined,
      weight: values.weight ? Number(values.weight) : undefined,
      height: values.height ? Number(values.height) : undefined,
      experienceLevel: values.experienceLevel || undefined,
      photoUrl: values.photoUrl || undefined,
      bioRu: values.bioRu || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit(onValid)} className="space-y-8">
      {/* Photo */}
      <ImageUpload
        value={photoUrl ?? ''}
        onChange={(url) => setValue('photoUrl', url)}
        label={t('photo_label')}
      />

      {/* Basic */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest mb-4 pb-2 border-b border-white/10 text-[var(--color-accent)]">
          {t('section_basic')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>{t('field_first_name')}</Label>
            <input {...register('firstName')} className={FIELD_CLASS} />
            {errors.firstName && (
              <p className="text-red-400 text-xs mt-1">{tCommon('error_required')}</p>
            )}
          </div>
          <div>
            <Label>{t('field_last_name')}</Label>
            <input {...register('lastName')} className={FIELD_CLASS} />
            {errors.lastName && (
              <p className="text-red-400 text-xs mt-1">{tCommon('error_required')}</p>
            )}
          </div>
          <div>
            <Label>{t('field_sport')}</Label>
            <select {...register('sportId')} className={SELECT_CLASS}>
              <option value="">{t('field_sport_placeholder')}</option>
              {sports?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nameRu}
                </option>
              ))}
            </select>
            {errors.sportId && (
              <p className="text-red-400 text-xs mt-1">{tCommon('error_required')}</p>
            )}
          </div>
          <div>
            <Label>{t('field_level')}</Label>
            <select {...register('experienceLevel')} className={SELECT_CLASS}>
              <option value="">{t('level_not_set')}</option>
              <option value="beginner">{t('level_beginner')}</option>
              <option value="intermediate">{t('level_intermediate')}</option>
              <option value="advanced">{t('level_advanced')}</option>
              <option value="professional">{t('level_professional')}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Personal */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest mb-4 pb-2 border-b border-white/10 text-[var(--color-accent)]">
          {t('section_personal')}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label>{t('field_gender')}</Label>
            <select {...register('gender')} className={SELECT_CLASS}>
              <option value="">{t('gender_not_set')}</option>
              <option value="male">{t('gender_male')}</option>
              <option value="female">{t('gender_female')}</option>
            </select>
          </div>
          <div>
            <Label>{t('field_hand')}</Label>
            <select {...register('primaryHand')} className={SELECT_CLASS}>
              <option value="">{t('hand_not_set')}</option>
              <option value="right">{t('hand_right')}</option>
              <option value="left">{t('hand_left')}</option>
              <option value="both">{t('hand_both')}</option>
            </select>
          </div>
          <div>
            <Label>{t('field_weight')}</Label>
            <input
              type="number"
              {...register('weight')}
              min={20}
              max={300}
              step={0.1}
              placeholder={t('field_weight_placeholder')}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <Label>{t('field_height')}</Label>
            <input
              type="number"
              {...register('height')}
              min={100}
              max={250}
              placeholder={t('field_height_placeholder')}
              className={FIELD_CLASS}
            />
          </div>
          <div>
            <Label>{t('field_country')}</Label>
            <CountryPicker
              value={watch('country') ?? ''}
              onChange={(v) => setValue('country', v, { shouldDirty: true })}
              allowFreeText
            />
          </div>
          <div>
            <Label>{t('field_city')}</Label>
            <input
              {...register('city')}
              placeholder={t('field_city_placeholder')}
              className={FIELD_CLASS}
            />
          </div>
        </div>
      </div>

      {/* Bio */}
      <div>
        <h2 className="text-xs font-black uppercase tracking-widest mb-4 pb-2 border-b border-white/10 text-[var(--color-accent)]">
          {t('section_bio')}
        </h2>
        <div>
          <Label>{t('field_bio')}</Label>
          <textarea
            {...register('bioRu')}
            rows={4}
            placeholder={t('field_bio_placeholder')}
            className={`${FIELD_CLASS} resize-none`}
          />
        </div>
      </div>

      {isError && (
        <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
          {t('error_save')}:{' '}
          {(error as any)?.response?.data?.message ?? (error as any)?.message ?? ''}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          type="submit"
          disabled={isPending}
          className="px-6 py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50 bg-[var(--color-accent)]"
        >
          {isPending ? t('submitting') : t('submit_save')}
        </button>
        <Link
          href="/admin/athletes"
          className="px-6 py-3 rounded-xl font-medium border border-white/10 hover:bg-white/10 transition-colors text-[var(--color-text-secondary)]"
        >
          {t('cancel')}
        </Link>
      </div>
    </form>
  );
}
