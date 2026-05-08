/**
 * Next.js instrumentation hook (Next 13.4+). Runs once per runtime
 * (Node server, Edge) at process startup. We use it to load the
 * appropriate Sentry init file so server / edge / client configs each
 * register the right SDK build.
 *
 * No-op when `SENTRY_DSN` is unset — see each *.config.ts file.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
