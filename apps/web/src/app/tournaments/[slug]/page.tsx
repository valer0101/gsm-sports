import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getLocale } from 'next-intl/server';
import type { Tournament } from '@/types/api';

async function getTournament(slug: string): Promise<Tournament | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';
    const res = await fetch(`${apiUrl}/tournaments/${slug}`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function formatDate(dateStr: string, locale: string) {
  return new Date(dateStr).toLocaleDateString(
    locale === 'hy' ? 'hy-AM' : locale === 'ru' ? 'ru-RU' : 'en-US',
    {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    },
  );
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tournament = await getTournament(slug);
  if (!tournament) notFound();

  const locale = await getLocale();
  const t = await getTranslations('tournaments');
  const tCommon = await getTranslations('common');

  const description =
    locale === 'ru'
      ? tournament.descriptionRu
      : locale === 'hy'
        ? tournament.descriptionHy
        : tournament.descriptionEn;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <Link
        href="/tournaments"
        className="inline-flex items-center gap-2 text-sm mb-6 transition-colors hover:text-white"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 19l-7-7m0 0l7-7m-7 7h18"
          />
        </svg>
        {tCommon('back')}
      </Link>

      {/* Hero card */}
      <div
        className="rounded-2xl border border-white/10 p-6 sm:p-8 mb-8"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
            {tournament.name}
          </h1>
          <div className="flex gap-2 flex-wrap">
            {tournament.registrationOpen && (
              <span className="text-sm px-3 py-1 rounded-full bg-green-500/15 text-green-300">
                {t('registration_open')}
              </span>
            )}
            {tournament.isLive && (
              <span className="text-sm px-3 py-1 rounded-full bg-red-500/20 text-red-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                LIVE
              </span>
            )}
          </div>
        </div>

        {description && (
          <p
            className="text-base leading-relaxed mb-6"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {description}
          </p>
        )}

        {/* Details grid */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt
              className="text-xs uppercase tracking-wider mb-1"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('starts')}
            </dt>
            <dd className="font-semibold text-white">{formatDate(tournament.startDate, locale)}</dd>
          </div>
          {tournament.endDate && (
            <div>
              <dt
                className="text-xs uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('ends')}
              </dt>
              <dd className="font-semibold text-white">{formatDate(tournament.endDate, locale)}</dd>
            </div>
          )}
          {(tournament.city || tournament.country) && (
            <div>
              <dt
                className="text-xs uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('location')}
              </dt>
              <dd className="font-semibold text-white">
                {[tournament.city, tournament.country].filter(Boolean).join(', ')}
              </dd>
            </div>
          )}
          {tournament.maxParticipants && (
            <div>
              <dt
                className="text-xs uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('participants')}
              </dt>
              <dd className="font-semibold text-white">{tournament.maxParticipants}</dd>
            </div>
          )}
          {tournament.sport && (
            <div>
              <dt
                className="text-xs uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                Sport
              </dt>
              <dd className="font-semibold" style={{ color: 'var(--color-accent)' }}>
                {tournament.sport.nameRu}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Weight categories */}
      {tournament.weightCategories?.length > 0 && (
        <div
          className="rounded-xl border border-white/10 p-6"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <h2 className="font-bold text-white mb-4">{t('weight_categories')}</h2>
          <div className="flex flex-wrap gap-2">
            {tournament.weightCategories.map((wc) => (
              <span
                key={wc.id}
                className="px-3 py-1.5 rounded-full text-sm border border-white/15"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {wc.name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
