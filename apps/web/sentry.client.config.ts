import * as Sentry from '@sentry/nextjs';

/**
 * Client-side Sentry init. Bundled into every page via Next.js's Sentry
 * integration (registered automatically when this file is present at the
 * app root). No-op without `NEXT_PUBLIC_SENTRY_DSN` so dev/CI runs don't
 * report.
 *
 * `NEXT_PUBLIC_*` is required because this file ships in the browser
 * bundle; the regular `SENTRY_DSN` is a server-only env var.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.NEXT_PUBLIC_SENTRY_RELEASE,
    tracesSampleRate: parseFloat(
      process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ??
        (process.env.NODE_ENV === 'production' ? '0.1' : '1.0'),
    ),
    // Replay only a tiny fraction of regular sessions; capture every
    // session that ends in an error so we can debug user-visible bugs.
    replaysSessionSampleRate: 0.0,
    replaysOnErrorSampleRate: 1.0,
  });
}
