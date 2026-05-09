'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route-level error boundary — catches errors thrown inside any page
 * under `app/`. Server errors propagate here as soon as the client
 * receives them; client errors (rendering, useEffect) hit it directly.
 *
 * Kept locale-neutral on purpose: next-intl context isn't guaranteed
 * to survive the failure that put us here. The body shows the message
 * in three languages so any visitor can recognize it. When a real
 * error-reporter (Sentry, etc.) is wired into instrumentation, this
 * file should report the error there — until then we only console.error
 * in development.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('App route error:', error);
    }
  }, [error]);

  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-[var(--color-text-primary)]">
        Something went wrong
      </h1>
      <p className="mt-2 text-base text-[var(--color-text-secondary)]">
        Что-то пошло не так · Ինչ-որ բան սխալ գնաց
      </p>
      <p className="mt-4 max-w-md text-base text-[var(--color-text-secondary)]">
        We hit an unexpected error. Try again, or head back to the homepage.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-[var(--color-text-muted)]">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--color-primary-hover)] transition-colors"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-[var(--color-border)] bg-[var(--color-surface-2)] px-5 py-2.5 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-strong)] transition-colors"
        >
          Go home
        </Link>
      </div>
    </main>
  );
}
