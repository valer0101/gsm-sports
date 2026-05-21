'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailInner />
    </Suspense>
  );
}

function VerifyEmailInner() {
  const t = useTranslations('auth');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const mutation = useMutation({
    mutationFn: (tok: string) =>
      api.get(`/auth/verify-email?token=${encodeURIComponent(tok)}`).then((r: any) => r.data),
  });

  // Trigger once on mount with the token from the URL.
  useEffect(() => {
    if (token) mutation.mutate(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8 text-center"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <h1 className="text-2xl font-black text-white mb-6">{t('verify_title')}</h1>
        {mutation.isPending && <p className="text-white">{t('verify_pending')}</p>}
        {mutation.isSuccess && <p className="text-green-400">{t('verify_ok')}</p>}
        {mutation.isError && <p className="text-red-400">{t('verify_failed')}</p>}
        {(mutation.isSuccess || mutation.isError) && (
          <Link
            href="/auth/login"
            className="block mt-6 text-white underline hover:no-underline"
          >
            {t('go_login')}
          </Link>
        )}
      </div>
    </div>
  );
}
