'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';

type FormData = { email: string };

export default function ForgotPasswordPage() {
  const t = useTranslations('auth');
  const [sent, setSent] = useState(false);

  const schema = z.object({
    email: z.string().email(t('error_invalid_email')),
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: (data: FormData) => api.post('/auth/forgot-password', data).then((r: any) => r.data),
    onSuccess: () => setSent(true),
  });

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <h1 className="text-2xl font-black text-white mb-2">{t('forgot_title')}</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          {t('forgot_subtitle')}
        </p>

        {sent ? (
          <div>
            <h2 className="text-xl font-bold text-white mb-2">{t('forgot_sent_title')}</h2>
            <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
              {t('forgot_sent_body')}
            </p>
            <Link
              href="/auth/login"
              className="block mt-6 text-center text-white underline hover:no-underline"
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
                {t('email')}
              </label>
              <input
                {...register('email')}
                type="email"
                autoComplete="email"
                placeholder="user@example.com"
                className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
              {errors.email && (
                <p className="text-xs text-red-400 mt-1">{errors.email.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={mutation.isPending}
              className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50 mt-2"
              style={{ backgroundColor: 'var(--color-accent)' }}
            >
              {mutation.isPending ? t('forgot_submitting') : t('forgot_submit')}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
