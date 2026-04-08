'use client';

import { Suspense } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

type FormData = { login: string; password: string };

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();

  const schema = z.object({
    login: z.string().min(1, t('field_required')),
    password: z.string().min(1, t('field_required')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/auth/login', data),
    onSuccess: () => {
      const raw = searchParams.get('redirect') || '/admin';
      const redirect = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/admin';
      router.push(redirect);
    },
  });

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <h1 className="text-2xl font-black text-white mb-2">{t('login_title')}</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          {t('login_subtitle')}
        </p>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('login_field')}
            </label>
            <input
              {...register('login')}
              type="text"
              autoComplete="username"
              placeholder={t('login_placeholder')}
              className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
            />
            {errors.login && (
              <p className="text-xs text-red-400 mt-1">{errors.login.message}</p>
            )}
          </div>

          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('password_field')}
            </label>
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
            />
            {errors.password && (
              <p className="text-xs text-red-400 mt-1">{errors.password.message}</p>
            )}
          </div>

          {mutation.isError && (
            <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
              {(mutation.error as any)?.response?.data?.message ?? t('error_invalid')}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50 mt-2"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {mutation.isPending ? t('submitting_login') : t('submit_login')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('no_account')}{' '}
          <Link href="/auth/register" className="text-white underline hover:no-underline">
            {t('go_register')}
          </Link>
        </p>
      </div>
    </div>
  );
}
