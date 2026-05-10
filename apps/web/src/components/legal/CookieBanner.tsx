'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const COOKIE_KEY = 'gsm_cookie_consent';

type Consent = 'accepted' | 'rejected';

/**
 * Cookie banner. Today the platform sets only strictly-necessary cookies
 * (session token, locale, this dismissal flag) — but we surface both
 * Accept and Reject so the UI is GDPR-future-proof: the moment any
 * non-essential cookie (Sentry session-replay, analytics, ads) ships,
 * the consent gate is already in place. Storing the user's choice as
 * `'rejected'` rather than just hiding the banner means downstream
 * conditional-load helpers can read `localStorage` and skip non-essential
 * scripts cleanly.
 *
 * The dismissal flag persists in localStorage so the banner stays hidden
 * across sessions on the same device. We read it from a deferred effect
 * so the SSR HTML is consistent and there's no flash on hydration.
 */
export function CookieBanner() {
  const t = useTranslations('cookie_banner');
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COOKIE_KEY);
      if (stored !== 'accepted' && stored !== 'rejected') setVisible(true);
    } catch {
      // localStorage may be unavailable (private mode, sandboxed iframe).
      // Show the banner — being slightly annoying is better than skipping
      // consent silently.
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const persist = (choice: Consent) => {
    try {
      window.localStorage.setItem(COOKIE_KEY, choice);
    } catch {
      /* fall through — closing the banner is the user signal */
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label={t('label')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--color-text-secondary)]">
          {t('message')}{' '}
          <Link
            href="/legal/privacy"
            className="font-semibold underline underline-offset-2 text-[var(--color-text-primary)] hover:text-[var(--color-primary)] transition-colors"
          >
            {t('privacy_link')}
          </Link>
          .
        </p>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={() => persist('rejected')}
            className="rounded-md border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
          >
            {t('reject')}
          </button>
          <button
            type="button"
            onClick={() => persist('accepted')}
            className="rounded-md bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
          >
            {t('accept')}
          </button>
        </div>
      </div>
    </div>
  );
}
