'use client';

import Link from 'next/link';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useSports } from '@/hooks/useSports';

const SUB_LINKS = [
  { key: 'tournaments', segment: 'tournaments' },
  { key: 'athletes', segment: 'athletes' },
  { key: 'rankings', segment: 'rankings' },
] as const;

export default function SportDetailLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('sport');
  const tNav = useTranslations('nav');
  const pathname = usePathname();
  const { sport: sportSlug } = useParams<{ sport: string }>();

  const { data: sports = [] } = useSports();

  return (
    <div>
      {/* Yellow SPORT banner */}
      <div className="py-4 px-4" style={{ backgroundColor: 'var(--color-primary)' }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl font-black tracking-wider text-black">{t('title')}</h1>
        </div>
      </div>

      {/* Sports tabs + sub-pages in one bar */}
      <div className="border-b border-white/10" style={{ backgroundColor: 'var(--color-secondary)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center overflow-x-auto">

            {/* Sports list */}
            {sports.length > 0 ? (
              sports.map((s) => {
                const isActiveSport = s.slug === sportSlug;
                return (
                  <Link
                    key={s.slug}
                    href={`/sport/${s.slug}`}
                    className="px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors shrink-0"
                    style={{
                      borderColor: isActiveSport ? 'var(--color-primary)' : 'transparent',
                      color: isActiveSport ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                    }}
                  >
                    {s.nameEn}
                  </Link>
                );
              })
            ) : (
              /* Fallback пока спорты грузятся */
              <Link
                href={`/sport/${sportSlug}`}
                className="px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors"
                style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
              >
                {t('armwrestling')}
              </Link>
            )}

            {/* Разделитель */}
            <span className="mx-2 text-white/20 shrink-0">›</span>

            {/* Sub-pages */}
            {SUB_LINKS.map(({ key, segment }) => {
              const href = `/sport/${sportSlug}/${segment}`;
              const isActive = pathname === href || pathname.startsWith(href + '/');
              return (
                <Link
                  key={key}
                  href={href}
                  className="px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors shrink-0"
                  style={{
                    borderColor: isActive ? 'var(--color-primary)' : 'transparent',
                    color: isActive ? 'white' : 'var(--color-text-secondary)',
                  }}
                >
                  {tNav(key)}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {children}
    </div>
  );
}
