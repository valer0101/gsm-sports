import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { QueryProvider } from '@/providers/QueryProvider';
import { ConditionalLayout } from '@/components/layout/ConditionalLayout';
import './globals.css';

/**
 * Production requires `NEXT_PUBLIC_SITE_URL`; falling through to localhost
 * in a real build would point all canonical / OG / Twitter card URLs at
 * `http://localhost:3001`, silently breaking link previews. Throw at
 * module load so the misconfiguration is impossible to deploy by accident.
 */
function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SITE_URL must be set in production');
  }
  return 'http://localhost:3001';
}

const SITE_URL = resolveSiteUrl();

/**
 * Site-wide metadata. Per-page Metadata exports inherit from this
 * (Next merges shallow keys). `metadataBase` is required for
 * absolute URLs in OG / Twitter tags — without it Next 14 logs a
 * warning and downstream link previews break.
 */
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    template: '%s · GSM Sports',
    default: 'GSM Sports — Tournaments, Rankings, Athletes',
  },
  description:
    'Multi-sport platform for combat-sport tournaments: brackets, weigh-ins, rankings, live results, and athlete profiles.',
  applicationName: 'GSM Sports',
  authors: [{ name: 'GSM Sports' }],
  keywords: ['armwrestling', 'tournaments', 'brackets', 'sports', 'rankings'],
  openGraph: {
    title: 'GSM Sports',
    description:
      'Multi-sport platform for combat-sport tournaments: brackets, weigh-ins, rankings, live results.',
    siteName: 'GSM Sports',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'GSM Sports',
    description: 'Tournaments, rankings, and athlete profiles for combat sports.',
  },
  alternates: {
    canonical: '/',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <ConditionalLayout>{children}</ConditionalLayout>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
