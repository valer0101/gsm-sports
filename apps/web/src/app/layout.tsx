import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { Navbar } from '@/components/layout/Navbar';
import { QueryProvider } from '@/providers/QueryProvider';
import './globals.css';

export const metadata: Metadata = {
  title: 'GSM Sports',
  description: 'Multi-sport platform for tournaments, rankings, and athlete profiles',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={messages}>
          <QueryProvider>
            <div
              className="min-h-screen flex flex-col"
              style={{
                backgroundColor: 'var(--color-background)',
                color: 'var(--color-text-primary)',
              }}
            >
              <Navbar />
              <main className="flex-1">{children}</main>
              <footer
                className="border-t border-white/10 py-6 text-center text-sm"
                style={{
                  color: 'var(--color-text-secondary)',
                  backgroundColor: 'var(--color-secondary)',
                }}
              >
                © {new Date().getFullYear()} GSM Sports. All rights reserved.
              </footer>
            </div>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
