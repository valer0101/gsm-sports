'use client';

import { Suspense, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

type FormData = { password: string; passwordConfirm: string };

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [done, setDone] = useState(false);

  const schema = z
    .object({
      password: z.string().min(8, t('error_password_min')),
      passwordConfirm: z.string().min(8, t('error_password_min')),
    })
    .refine((d) => d.password === d.passwordConfirm, {
      path: ['passwordConfirm'],
      message: t('error_passwords_mismatch'),
    });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) =>
      api.post('/auth/reset-password', { token, password: data.password }).then((r: any) => r.data),
    onSuccess: () => setDone(true),
  });

  if (!token) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4">
        <p className="text-red-400">{t('reset_invalid_token')}</p>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <h1 className="text-2xl font-black text-white mb-2">{t('reset_title')}</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          {t('reset_subtitle')}
        </p>

        {done ? (
          <div>
            <p className="text-white mb-6">{t('reset_success')}</p>
            <Link
              href="/auth/login"
              className="block text-center text-white underline hover:no-underline"
            >
              {t('go_login')}
            </Link>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit((d) => mutation.mutate(d))}
            noValidate
            className="space-y-4"
          >
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('reset_password')}
              </label>
              <input
                {...register('password')}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              {errors.password && (
                <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
              )}
            </div>
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('reset_password_confirm')}
              </label>
              <input
                {...register('passwordConfirm')}
                type="password"
                autoComplete="new-password"
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              {errors.passwordConfirm && (
                <p className="text-xs text-red-400 mt-1">{errors.passwordConfirm.message}</p>
              )}
            </div>
            {mutation.isError && (
              <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
                {(mutation.error as any)?.response?.data?.message ?? t('reset_invalid_token')}
              </p>
            )}
            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50 mt-2"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {mutation.isPending ? t('reset_submitting') : t('reset_submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
