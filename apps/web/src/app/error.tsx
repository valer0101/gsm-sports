'use client';

import { useEffect } from 'react';

/**
 * Route-level error boundary — catches errors thrown inside any page
 * under `app/`. Server errors propagate here as soon as the client
 * receives them; client errors (rendering, useEffect) hit it directly.
 *
 * The component is intentionally minimal: no next-intl, no React Query,
 * no auth — those layers may themselves be broken when this fires.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Sentry's Next.js SDK auto-captures errors that bubble here when
    // `NEXT_PUBLIC_SENTRY_DSN` is set; we just log to console as a
    // dev-time aid in case the SDK isn't active.
    if (process.env.NODE_ENV !== 'production') {
      console.error('App route error:', error);
    }
  }, [error]);

  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-5xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
        Something went wrong
      </h1>
      <p className="mt-4 max-w-md text-base text-zinc-600 dark:text-zinc-300">
        We hit an unexpected error. The team has been notified — try again, or head back to the
        homepage.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-zinc-400 dark:text-zinc-500">
          Reference: <code className="font-mono">{error.digest}</code>
        </p>
      )}
      <div className="mt-8 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Try again
        </button>
        <a
          href="/"
          className="rounded-md border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Go home
        </a>
      </div>
    </main>
  );
}
