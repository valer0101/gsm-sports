'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

const schema = z
  .object({
    firstName: z.string().min(1, 'Обязательное поле'),
    lastName: z.string().min(1, 'Обязательное поле'),
    email: z.string().email('Некорректный email'),
    phone: z.string().optional(),
    password: z.string().min(8, 'Минимум 8 символов'),
    confirmPassword: z.string().min(1, 'Обязательное поле'),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Пароли не совпадают',
    path: ['confirmPassword'],
  });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const t = useTranslations('auth');
  const router = useRouter();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema) });

  const mutation = useMutation({
    mutationFn: ({ confirmPassword: _, ...data }: FormData) =>
      api.post('/auth/register', { ...data, phone: data.phone || undefined }),
    onSuccess: () => router.push('/'),
  });

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-10">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <h1 className="text-2xl font-black text-white mb-2">{t('register_title')}</h1>
        <p className="text-sm mb-8" style={{ color: 'var(--color-text-secondary)' }}>
          {t('register_subtitle')}
        </p>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label={t('first_name')} error={errors.firstName?.message}>
              <input
                {...register('firstName')}
                placeholder="Арам"
                className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </Field>
            <Field label={t('last_name')} error={errors.lastName?.message}>
              <input
                {...register('lastName')}
                placeholder="Петросян"
                className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
              />
            </Field>
          </div>

          <Field label={t('email')} error={errors.email?.message}>
            <input
              {...register('email')}
              type="email"
              placeholder="aram@example.com"
              className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </Field>

          <Field label={t('phone')} error={errors.phone?.message}>
            <input
              {...register('phone')}
              type="tel"
              placeholder="+374 91 000000"
              className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </Field>

          <Field label={t('password')} error={errors.password?.message}>
            <input
              {...register('password')}
              type="password"
              placeholder={t('password_hint')}
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </Field>

          <Field label={t('confirm_password')} error={errors.confirmPassword?.message}>
            <input
              {...register('confirmPassword')}
              type="password"
              placeholder="••••••••"
              autoComplete="new-password"
              className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors"
            />
          </Field>

          {mutation.isError && (
            <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
              {(() => {
                const msg = (mutation.error as any)?.response?.data?.message;
                return Array.isArray(msg) ? msg.join(', ') : (msg ?? t('error_register'));
              })()}
            </p>
          )}

          <button
            type="submit"
            disabled={mutation.isPending}
            className="w-full py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50 mt-2"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {mutation.isPending ? t('submitting_register') : t('submit_register')}
          </button>
        </form>

        <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-secondary)' }}>
          {t('has_account')}{' '}
          <Link href="/auth/login" className="text-white underline hover:no-underline">
            {t('go_login')}
          </Link>
        </p>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {label}
      </label>
      {children}
      {error && <p className="text-xs text-red-400 mt-1">{error}</p>}
    </div>
  );
}
