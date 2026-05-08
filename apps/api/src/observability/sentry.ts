import * as Sentry from '@sentry/node';

/**
 * Initialise Sentry for the API process. Call once, BEFORE NestFactory.create
 * — the Sentry SDK monkey-patches Node's `http` / `https` modules to capture
 * outgoing requests and unhandled exceptions, so it must run before any
 * server bootstraps.
 *
 * Activation is env-driven:
 *   - SENTRY_DSN         (required) — public ingestion URL from sentry.io.
 *                                     Without it, init is a no-op so dev
 *                                     and CI can run with the same code.
 *   - SENTRY_ENVIRONMENT (optional) — defaults to NODE_ENV.
 *   - SENTRY_RELEASE     (optional) — git SHA from CI; tags errors with the
 *                                     deploy that introduced them.
 *   - SENTRY_TRACES_SAMPLE_RATE (optional) — 0..1, defaults to 0.1 in prod,
 *                                     1.0 in dev. Performance traces are
 *                                     expensive at scale; sample heavily.
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  const environment = process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? 'development';
  const release = process.env.SENTRY_RELEASE;
  const tracesSampleRate = parseFloat(
    process.env.SENTRY_TRACES_SAMPLE_RATE ?? (environment === 'production' ? '0.1' : '1.0'),
  );

  Sentry.init({
    dsn,
    environment,
    release,
    tracesSampleRate,
  });

  return true;
}

/**
 * Re-export the Sentry SDK so callers (the global filter, custom error
 * sites) don't need to depend on the package directly — keeps the wiring
 * point in one file.
 */
export { Sentry };
