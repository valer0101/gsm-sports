'use client';

import { useEffect } from 'react';

/**
 * Last-resort error boundary — catches errors thrown in the root
 * layout itself (NextIntlProvider, QueryProvider, html/body markup).
 * Must render its own <html>/<body> because the regular layout has
 * already failed by the time this fires.
 *
 * Kept text-only with inline styles so it works even if globals.css
 * fails to load.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('Global error:', error);
    }
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          background: '#fafafa',
          color: '#18181b',
          padding: '2rem',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: '32rem' }}>
          <h1 style={{ fontSize: '2.5rem', fontWeight: 700, margin: 0 }}>Something went wrong</h1>
          <p style={{ marginTop: '1rem', color: '#52525b' }}>
            The site couldn&apos;t load this page. Please try again, or come back in a few minutes.
          </p>
          {error.digest && (
            <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#a1a1aa' }}>
              Reference: <code>{error.digest}</code>
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: '2rem',
              padding: '0.625rem 1.25rem',
              borderRadius: '0.375rem',
              border: 'none',
              background: '#18181b',
              color: '#fafafa',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
