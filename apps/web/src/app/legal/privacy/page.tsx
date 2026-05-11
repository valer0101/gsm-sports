import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

const PRIVACY_EMAIL =
  process.env.NEXT_PUBLIC_PRIVACY_EMAIL ??
  process.env.NEXT_PUBLIC_CONTACT_EMAIL ??
  'hello@gsm-sports.example';

export const metadata: Metadata = {
  title: 'Privacy Policy · GSM Sports',
  description: 'How GSM Sports collects, stores, and processes personal data.',
  // Placeholder copy stays out of the index until legal counsel signs
  // off. Flip to `index: true` (and add to `sitemap.ts`) once finalized.
  robots: { index: false, follow: false },
};

/**
 * Privacy Policy — placeholder shell. Mirrors the structure expected by
 * GDPR / Armenian data-protection law: lawful basis, retention, rights,
 * contact. Replace the body with finalised legal text before launch.
 */
export default async function PrivacyPage() {
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

      <h1>Privacy Policy</h1>
      <p className="text-sm text-[var(--color-text-muted)]">
        {t('last_updated')}: <time dateTime="2026-05-08">8 May 2026</time>
      </p>

      <p>
        This Privacy Policy explains what data the GSM Sports platform (the &ldquo;Service&rdquo;)
        collects, why, and what rights you have over it. It applies to anyone who uses the
        Service — athletes, organizers, operators, and visitors.
      </p>

      <h2>1. Data we collect</h2>
      <ul>
        <li>
          <strong>Account data</strong> — email, phone, name, country, optional profile photo;
          stored when you register.
        </li>
        <li>
          <strong>Athlete data</strong> — date of birth, weight, hand preference, ranking
          history, tournament results.
        </li>
        <li>
          <strong>Tournament data</strong> — entries, weigh-ins, match results, audit trail of
          who entered what.
        </li>
        <li>
          <strong>Technical data</strong> — IP address, browser type, error reports (via Sentry
          when enabled), aggregate usage logs. We do not use third-party advertising trackers.
        </li>
      </ul>

      <h2>2. Lawful basis (GDPR Art. 6)</h2>
      <p>
        Account and tournament data are processed under <em>contract</em> (you registered to use
        the Service). Technical / error data are processed under <em>legitimate interest</em>{' '}
        (running the platform). Marketing emails — if any — are sent only with your explicit{' '}
        <em>consent</em>, which you can withdraw at any time.
      </p>

      <h2>3. How long we keep it</h2>
      <ul>
        <li>Account profile: until you delete the account.</li>
        <li>Tournament results: indefinitely, as part of the public sporting record.</li>
        <li>Server logs: 30 days.</li>
        <li>Backups: 90 days, encrypted at rest.</li>
      </ul>

      <h2>4. Who we share with</h2>
      <p>
        Tournament organizers see the entries and personal data of athletes registered to{' '}
        <em>their</em> events. Operators see only the events they&apos;re assigned to. We do not
        sell personal data. Sub-processors used to operate the Service:
      </p>
      <ul>
        <li>Hosting provider (Railway / Render / Hetzner — set at deploy time)</li>
        <li>Sentry (error reporting) — when enabled</li>
        <li>Email provider (Resend / SendGrid) — when enabled</li>
        <li>Telegram (notifications &amp; account recovery) — opt-in per user</li>
      </ul>

      <h2>5. Your rights</h2>
      <p>
        You can <strong>access</strong>, <strong>correct</strong>, or <strong>delete</strong>{' '}
        your account data from the Profile page at any time. You can request a machine-readable{' '}
        <strong>export</strong> of all data tied to your account by emailing{' '}
        <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>. You can lodge a complaint with
        your local data-protection authority.
      </p>

      <h2>6. Cookies</h2>
      <p>
        We use a small number of strictly necessary cookies — session token, language preference,
        cookie-banner dismissal. We don&apos;t set advertising or cross-site tracking cookies.
      </p>

      <h2>7. Security</h2>
      <p>
        Passwords are hashed with bcrypt. Tokens are signed with a server-side secret rotated on
        a regular basis. Production traffic is over HTTPS only. We follow defence-in-depth
        practices but no system is 100% secure.
      </p>

      <h2>8. Children</h2>
      <p>
        Accounts for athletes under 14 require a parent or guardian to register on their behalf.
        We do not knowingly collect data directly from children under 14.
      </p>

      <h2>9. Contact</h2>
      <p>
        Privacy questions: <a href={`mailto:${PRIVACY_EMAIL}`}>{PRIVACY_EMAIL}</a>
      </p>
    </main>
  );
}
