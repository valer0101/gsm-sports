import * as Sentry from '@sentry/nextjs';

/**
 * Edge-runtime Sentry init for Next.js. Used by the middleware and any
 * route handlers that opt into the edge runtime. Same env vars as the
 * server config — `SENTRY_DSN` is read at runtime (must be set on the
 * platform, not at build time).
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
