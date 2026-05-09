'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useTranslations } from 'next-intl';
import { useSetPassword } from '@/hooks/useProfile';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface FirstSetForm {
  password: string;
  confirmPassword: string;
}
interface ChangeForm {
  currentPassword: string;
  password: string;
  confirmPassword: string;
}

/**
 * Security section on /profile. Behaviour depends on
 * `currentUser.hasPassword`:
 *
 *   - false → first-set form (Google-only account attaching a password
 *     so they aren't locked in if they lose Google access).
 *   - true → standard change-password form, current password required.
 *
 * Errors are funnelled through the `apiErrorMessage` helper so the
 * 401 thrown by the backend on a wrong current password lands as a
 * field-level message rather than a generic toast.
 */
export function PasswordSection() {
  const t = useTranslations('profile_security');
  const { data: user } = useCurrentUser();
  const setPassword = useSetPassword();
  const [saved, setSaved] = useState(false);

  if (!user) return null;

  // Default to "change" semantics when the flag is missing — every
  // password-based account has one set, so requiring `currentPassword`
  // is the safer default than a free silent overwrite.
  const hasPassword = user.hasPassword !== false;

  return hasPassword ? (
    <ChangePasswordForm
      onSuccess={() => setSaved(true)}
      saved={saved}
      busy={setPassword.isPending}
      error={apiErrorMessage(setPassword.error, t('error'))}
      submit={(data) =>
        setPassword.mutate(
          { currentPassword: data.currentPassword, password: data.password },
          { onSuccess: () => setSaved(true) },
        )
      }
      t={t}
    />
  ) : (
    <FirstSetPasswordForm
      onSuccess={() => setSaved(true)}
      saved={saved}
      busy={setPassword.isPending}
      error={apiErrorMessage(setPassword.error, t('error'))}
      submit={(data) =>
        setPassword.mutate({ password: data.password }, { onSuccess: () => setSaved(true) })
      }
      t={t}
    />
  );
}

function FirstSetPasswordForm(props: {
  onSuccess: () => void;
  saved: boolean;
  busy: boolean;
  error: string | null;
  submit: (data: FirstSetForm) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const { t, busy, error, saved, submit } = props;
  const schema = z
    .object({
      password: z.string().min(8, t('error_password_min')),
      confirmPassword: z.string().min(1, t('field_required')),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t('error_passwords_mismatch'),
      path: ['confirmPassword'],
    });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FirstSetForm>({ resolver: zodResolver(schema) });

  return (
    <Section title={t('title')} description={t('first_set_description')}>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        <PasswordField
          label={t('new_password')}
          register={register('password')}
          error={errors.password?.message}
          autoComplete="new-password"
        />
        <PasswordField
          label={t('confirm_password')}
          register={register('confirmPassword')}
          error={errors.confirmPassword?.message}
          autoComplete="new-password"
        />
        <FormFooter busy={busy} saved={saved} error={error} t={t} />
      </form>
    </Section>
  );
}

function ChangePasswordForm(props: {
  onSuccess: () => void;
  saved: boolean;
  busy: boolean;
  error: string | null;
  submit: (data: ChangeForm) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const { t, busy, error, saved, submit } = props;
  const schema = z
    .object({
      currentPassword: z.string().min(1, t('field_required')),
      password: z.string().min(8, t('error_password_min')),
      confirmPassword: z.string().min(1, t('field_required')),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t('error_passwords_mismatch'),
      path: ['confirmPassword'],
    });
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ChangeForm>({ resolver: zodResolver(schema) });

  return (
    <Section title={t('title')} description={t('change_description')}>
      <form onSubmit={handleSubmit(submit)} noValidate className="space-y-4">
        <PasswordField
          label={t('current_password')}
          register={register('currentPassword')}
          error={errors.currentPassword?.message}
          autoComplete="current-password"
        />
        <PasswordField
          label={t('new_password')}
          register={register('password')}
          error={errors.password?.message}
          autoComplete="new-password"
        />
        <PasswordField
          label={t('confirm_password')}
          register={register('confirmPassword')}
          error={errors.confirmPassword?.message}
          autoComplete="new-password"
        />
        <FormFooter busy={busy} saved={saved} error={error} t={t} />
      </form>
    </Section>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border border-white/10 p-6"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <p
        className="text-xs uppercase tracking-wider mb-1"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {title}
      </p>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-secondary)' }}>
        {description}
      </p>
      {children}
    </div>
  );
}

function PasswordField({
  label,
  register,
  error,
  autoComplete,
}: {
  label: string;
  register: ReturnType<ReturnType<typeof useForm>['register']>;
  error?: string;
  autoComplete: 'current-password' | 'new-password';
}) {
  return (
    <div>
      <label
        className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </label>
      <input
        {...register}
        type="password"
        autoComplete={autoComplete}
        placeholder="••••••••"
        className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
      />
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}

function FormFooter({
  busy,
  saved,
  error,
  t,
}: {
  busy: boolean;
  saved: boolean;
  error: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <>
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">{error}</p>
      )}
      {saved && !error && <p className="text-sm text-green-400">{t('saved')}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50"
        style={{ backgroundColor: 'var(--color-primary)' }}
      >
        {busy ? t('saving') : t('submit')}
      </button>
    </>
  );
}

function apiErrorMessage(err: unknown, fallback: string): string | null {
  if (!err) return null;
  const msg = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data
    ?.message;
  if (Array.isArray(msg)) return msg.join(', ');
  return msg ?? fallback;
}
