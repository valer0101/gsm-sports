import Link from 'next/link';

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@gsm-sports.example';
const TELEGRAM = process.env.NEXT_PUBLIC_TELEGRAM_HANDLE ?? '';

/**
 * Site-wide footer. Renders in `ConditionalLayout` for public pages; the
 * admin / operator chrome has its own simpler footer (or none).
 *
 * Contact + legal links are required at launch:
 *   - email: legal contact for ToS / privacy questions
 *   - Privacy Policy: GDPR / Armenian DP-law requirement
 *   - Terms of Service: required by app stores, payment providers,
 *     and any future advertising network
 *
 * Both `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_TELEGRAM_HANDLE` are
 * env-driven so the placeholder values can be replaced at deploy time
 * without a rebuild.
 */
export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:justify-between">
        <div>
          <p className="text-base font-semibold text-zinc-900 dark:text-zinc-100">GSM Sports</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Tournaments, rankings, and athlete profiles for combat sports.
          </p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Contact
            </span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            >
              {CONTACT_EMAIL}
            </a>
            {TELEGRAM && (
              <a
                href={`https://t.me/${TELEGRAM.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
              >
                Telegram: @{TELEGRAM.replace(/^@/, '')}
              </a>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Legal
            </span>
            <Link
              href="/legal/terms"
              className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            >
              Terms of Service
            </Link>
            <Link
              href="/legal/privacy"
              className="text-zinc-700 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 dark:border-zinc-800">
        <p className="mx-auto max-w-6xl px-6 py-4 text-xs text-zinc-500 dark:text-zinc-500">
          © {year} GSM Sports · All rights reserved
        </p>
      </div>
    </footer>
  );
}
