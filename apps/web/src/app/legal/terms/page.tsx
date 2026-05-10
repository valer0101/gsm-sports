import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

const LEGAL_EMAIL =
  process.env.NEXT_PUBLIC_LEGAL_EMAIL ??
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ??
  'hello@gsm-sports.example';

export const metadata: Metadata = {
  title: 'Terms of Service · GSM Sports',
  description: 'Terms governing the use of the GSM Sports platform.',
  // Placeholder copy is intentionally kept out of the search index until
  // legal counsel signs off on the production text. Flip to `index: true`
  // (and re-add to `sitemap.ts`) once finalized.
  robots: { index: false, follow: false },
};

/**
 * Terms of Service — placeholder shell. Production text comes from
 * legal counsel (or a generator like termly.io) and replaces the
 * body. Until then, this page exists so the footer link, the
 * registration consent checkbox, and the cookie banner can already
 * point at a stable URL.
 *
 * The page uses `next-intl` `getTranslations` for the chrome (draft
 * banner, "Last updated" label) but keeps the body text in English —
 * full translations go in once the final wording is approved.
 */
export default async function TermsPage() {
  const t = await getTranslations('legal');

  return (
    <main className="prose prose-invert mx-auto max-w-3xl px-6 py-16">
      <div
        role="status"
        className="not-prose mb-8 rounded-md border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-4 py-3 text-sm"
      >
        <p className="font-semibold text-[var(--color-warning)]">{t('draft_banner_title')}</p>
        <p className="mt-1 text-[var(--color-text-secondary)]">{t('draft_banner_body')}</p>
      </div>

      <h1>Terms of Service</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        {t('last_updated')}: <time dateTime="2026-05-08">8 May 2026</time>
      </p>

      <p>
        These terms govern your use of the GSM Sports platform (the &ldquo;Service&rdquo;) operated
        by GSM Sports. By creating an account, registering for a tournament, or otherwise using
        the Service, you agree to these Terms.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be at least 14 years old to register an account. Athletes under 18 require a
        parent or guardian&apos;s consent to participate in tournaments organized through the
        platform.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your login credentials and for
        all activity under your account. Notify us immediately at{' '}
        <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a> if you suspect unauthorized access.
      </p>

      <h2>3. Tournament participation</h2>
      <p>
        Organizers run tournaments through the Service; GSM Sports provides the infrastructure but
        is not the organizer of record. Tournament-specific rules, refunds, and disputes are the
        responsibility of the listed organizer.
      </p>

      <h2>4. Conduct</h2>
      <p>
        You agree not to upload illegal, infringing, or harassing content; not to impersonate
        others; not to attempt to disrupt the Service&apos;s operation; and to respect the rules
        of any tournament you enter.
      </p>

      <h2>5. Content and image rights</h2>
      <p>
        Athletes grant the Service a non-exclusive license to display their tournament results,
        rankings, and uploaded photos for the purpose of operating the platform and reporting on
        events.
      </p>

      <h2>6. Termination</h2>
      <p>
        We may suspend or terminate accounts that violate these Terms. You may delete your
        account at any time from the Profile page; we retain anonymized tournament results as
        part of the historical record.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is.&rdquo; We don&apos;t guarantee uninterrupted
        availability and aren&apos;t liable for tournament outcomes, athlete injuries, or
        decisions made by referees and organizers.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these Terms; material changes will be announced on the homepage with at
        least 14 days notice before they take effect.
      </p>

      <h2>9. Contact</h2>
      <p>
        Questions about these Terms: <a href={`mailto:${LEGAL_EMAIL}`}>{LEGAL_EMAIL}</a>
      </p>
    </main>
  );
}
