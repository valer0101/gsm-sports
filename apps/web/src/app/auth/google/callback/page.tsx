'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

export default function GoogleCallbackPage() {
  return (
    <Suspense>
      <GoogleCallbackInner />
    </Suspense>
  );
}

/**
 * Lands here after the API's /auth/google/callback redirects us with
 * the access_token cookie already set. We just need to read the user
 * from /auth/me, mirror the same localStorage + cache shape that the
 * password login uses, and bounce to /admin (or wherever the user
 * was originally headed).
 */
function GoogleCallbackInner() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const ranRef = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    if (searchParams.get('status') === 'error') {
      setError(t('google_error'));
      return;
    }

    api
      .get('/auth/me')
      .then((r: any) => r.data)
      .then((data) => {
        const user = {
          id: data.id,
          email: data.email,
          firstName: data.firstName,
          lastName: data.lastName,
          roles: data.roles,
          avatarUrl: data.avatarUrl ?? null,
        };
        localStorage.setItem('gsm_user', JSON.stringify(user));
        queryClient.setQueryData(['currentUser'], user);
        const raw = searchParams.get('redirect') || '/admin';
        const redirect = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/admin';
        router.replace(redirect);
      })
      .catch(() => setError(t('google_error')));
  }, [router, searchParams, queryClient, t]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 p-8 text-center"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        {error ? (
          <>
            <h1 className="text-xl font-bold text-white mb-3">{t('google_failed_title')}</h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              {error}
            </p>
            <Link
              href="/auth/login"
              className="inline-block px-4 py-2 rounded-xl border border-white/15 text-white text-sm hover:bg-white/5"
            >
              {t('go_login')}
            </Link>
          </>
        ) : (
          <p className="text-white">{t('google_completing')}</p>
        )}
      </div>
    </div>
  );
}
