import * as Sentry from '@sentry/nextjs';

/**
 * Server-side Sentry init for Next.js. Captures exceptions in
 * server components, route handlers, and middleware. Uses the
 * server-only `SENTRY_DSN` (no NEXT_PUBLIC_ prefix).
 */
const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: parseFloat(
      process.env.SENTRY_TRACES_SAMPLE_RATE ??
        (process.env.NODE_ENV === 'production' ? '0.1' : '1.0'),
    ),
  });
}
