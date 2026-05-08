'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const COOKIE_KEY = 'gsm_cookie_consent';

/**
 * Minimal cookie banner. We only set strictly-necessary cookies (session
 * token, locale, this dismissal flag) — no advertising / tracking — so a
 * single &ldquo;Got it&rdquo; affirmation is enough; no opt-in/opt-out
 * categories are needed today. When advertising or analytics cookies are
 * added later, expand this into a real consent UI (categories + revoke).
 *
 * Persists the dismissal in localStorage so the banner stays hidden across
 * sessions on the same device. Reads it via a deferred effect so server-
 * rendered HTML is consistent and there&apos;s no flash on hydration.
 */
export function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(COOKIE_KEY);
      if (stored !== 'accepted') setVisible(true);
    } catch {
      // localStorage may be unavailable (private mode, sandboxed iframe).
      // Show the banner — being slightly annoying is better than skipping
      // consent silently.
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const accept = () => {
    try {
      window.localStorage.setItem(COOKIE_KEY, 'accepted');
    } catch {
      /* fall through — closing the banner is the user signal */
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-zinc-200 bg-white/95 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-700 dark:text-zinc-200">
          We use a few essential cookies to keep you signed in and remember your language. No
          tracking or ads.{' '}
          <Link
            href="/legal/privacy"
            className="font-semibold underline underline-offset-2 hover:text-zinc-900 dark:hover:text-white"
          >
            Privacy Policy
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={accept}
          className="shrink-0 rounded-md bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Got it
        </button>
      </div>
    </div>
  );
}
