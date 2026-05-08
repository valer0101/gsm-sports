import Link from 'next/link';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 — Page not found · GSM Sports',
  robots: { index: false, follow: false },
};

/**
 * Global 404 — rendered when no route in `app/` matches the URL.
 * Kept text-only and locale-neutral so it works across all three
 * site locales without depending on next-intl context (which isn't
 * guaranteed to be loaded for arbitrary unknown URLs).
 */
export default function NotFound() {
  return (
    <main className="min-h-[60vh] flex flex-col items-center justify-center px-6 py-20 text-center">
      <h1 className="text-6xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">404</h1>
      <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-300">
        Page not found · Страница не найдена · Էջը չի գտնվել
      </p>
      <p className="mt-2 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
        The link may be broken, or the page may have been removed. Check the URL or return to the homepage.
      </p>
      <Link
        href="/"
        className="mt-8 rounded-md bg-zinc-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        Go to homepage
      </Link>
    </main>
  );
}
