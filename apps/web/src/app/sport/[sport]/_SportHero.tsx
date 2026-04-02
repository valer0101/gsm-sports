'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function SportHero({ sportSlug }: { sportSlug: string }) {
  const t = useTranslations('home');
  const tNav = useTranslations('nav');

  return (
    <section className="relative overflow-hidden py-20 px-4">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-10 blur-3xl"
          style={{ backgroundColor: 'var(--color-primary)' }}
        />
      </div>

      <div className="relative max-w-4xl mx-auto text-center space-y-6">
        <div
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 text-sm mb-4"
          style={{ color: 'var(--color-accent)' }}
        >
          <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
          GSM Sports Platform
        </div>

        <h1 className="text-5xl sm:text-6xl font-black tracking-tight">
          <span style={{ color: 'var(--color-primary)' }}>GSM</span>{' '}
          <span className="text-white">SPORTS</span>
        </h1>

        <p className="text-xl max-w-2xl mx-auto" style={{ color: 'var(--color-text-secondary)' }}>
          {t('subtitle')}
        </p>

        <div className="flex flex-wrap gap-4 justify-center mt-8">
          <Link
            href={`/sport/${sportSlug}/tournaments`}
            className="px-7 py-3.5 rounded-xl font-semibold text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-primary)' }}
          >
            {tNav('tournaments')}
          </Link>
          <Link
            href={`/sport/${sportSlug}/rankings`}
            className="px-7 py-3.5 rounded-xl font-semibold border transition-colors hover:bg-white/5"
            style={{ borderColor: 'var(--color-accent)', color: 'var(--color-accent)' }}
          >
            {tNav('rankings')}
          </Link>
          <Link
            href={`/sport/${sportSlug}/athletes`}
            className="px-7 py-3.5 rounded-xl font-semibold border border-white/20 transition-colors hover:bg-white/5"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {tNav('athletes')}
          </Link>
        </div>
      </div>
    </section>
  );
}
