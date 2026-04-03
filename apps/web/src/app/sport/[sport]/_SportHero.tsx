'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function SportHero({ sportSlug }: { sportSlug: string }) {
  const t = useTranslations('home');
  const tNav = useTranslations('nav');

  return (
    <section className="relative overflow-hidden min-h-[880px] flex items-center px-4">
      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src="/arm.png"
          alt="Arm wrestling"
          fill
          className="object-cover"
          style={{ objectPosition: 'right 30%' }}
          priority
        />
        {/* Gradient: dark on left, transparent on right */}
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent" />
      </div>

      {/* Content — left side */}
      <div className="relative max-w-6xl mx-auto w-full py-20">
        <div className="max-w-xl space-y-6">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/15 text-sm"
            style={{ color: 'var(--color-accent)' }}
          >
            <span className="w-2 h-2 rounded-full bg-current animate-pulse" />
            GSM Sports Platform
          </div>

          <h1 className="text-5xl sm:text-6xl font-black tracking-tight leading-tight">
            <span style={{ color: 'var(--color-primary)' }}>GSM</span>{' '}
            <span className="text-white">SPORTS</span>
          </h1>

          <p
            className="text-xl border-l-4 pl-4"
            style={{
              color: 'var(--color-text-secondary)',
              borderColor: 'var(--color-primary)',
            }}
          >
            {t('subtitle')}
          </p>

          <div className="flex flex-wrap gap-4 pt-2">
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
      </div>
    </section>
  );
}
