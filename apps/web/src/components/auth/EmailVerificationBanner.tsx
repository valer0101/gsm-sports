'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';

/**
 * Shown on any authenticated page when the current user has not verified
 * their email. Soft gate — does NOT block access. Calls
 * /auth/resend-verification to fire a fresh email.
 *
 * Consumer is responsible for deciding when to render this (read the
 * currentUser query and only mount if `isVerified === false`).
 */
export function EmailVerificationBanner({ email }: { email: string }) {
  const t = useTranslations('auth');
  const [sent, setSent] = useState(false);

  const mutation = useMutation({
    mutationFn: () => api.post('/auth/resend-verification', { email }).then((r: any) => r.data),
    onSuccess: () => setSent(true),
  });

  return (
    <div
      role="status"
      className="w-full px-4 py-3 flex items-center justify-between gap-4 text-sm border-b border-amber-400/30"
      style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)', color: 'var(--color-text-primary)' }}
    >
      <span>{t('verify_banner_text')}</span>
      {sent ? (
        <span className="text-amber-300">{t('verify_banner_sent')}</span>
      ) : (
        <button
          type="button"
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          className="underline hover:no-underline disabled:opacity-50"
        >
          {t('verify_banner_resend')}
        </button>
      )}
    </div>
  );
}
