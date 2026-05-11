'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'hello@gsm-sports.example';
const TELEGRAM = process.env.NEXT_PUBLIC_TELEGRAM_HANDLE ?? '';

/**
 * Site-wide footer. Renders in `ConditionalLayout` for public pages; the
 * admin / operator chrome has its own simpler footer (or none).
 *
 * All visible text is routed through next-intl (`footer` namespace).
 * Combat Energy tokens (--color-surface, --color-border, etc.) keep this
 * consistent with the rest of the site — see `docs/design/00-DESIGN-SYSTEM.md`.
 *
 * Both `NEXT_PUBLIC_CONTACT_EMAIL` and `NEXT_PUBLIC_TELEGRAM_HANDLE` are
 * env-driven so the placeholder values can be replaced at deploy time
 * without a rebuild.
 */
export function SiteFooter() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-10 sm:flex-row sm:justify-between">
        <div>
          <p className="text-base font-semibold text-[var(--color-text-primary)]">GSM Sports</p>
          <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t('tagline')}</p>
        </div>

        <div className="flex flex-wrap gap-x-8 gap-y-3 text-sm">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t('contact_label')}
            </span>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {CONTACT_EMAIL}
            </a>
            {TELEGRAM && (
              <a
                href={`https://t.me/${TELEGRAM.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                {t('telegram_label')}: @{TELEGRAM.replace(/^@/, '')}
              </a>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-text-muted)]">
              {t('legal_label')}
            </span>
            <Link
              href="/legal/terms"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {t('terms')}
            </Link>
            <Link
              href="/legal/privacy"
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {t('privacy')}
            </Link>
          </div>
        </div>
      </div>

      <div className="border-t border-[var(--color-border)]">
        <p className="mx-auto max-w-6xl px-6 py-4 text-xs text-[var(--color-text-muted)]">
          © {year} GSM Sports · {t('rights_reserved')}
        </p>
      </div>
    </footer>
  );
}
