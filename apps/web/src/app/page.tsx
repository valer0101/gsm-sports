'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { usePublicNews, type NewsItem } from '@/hooks/useNews';
import { Skeleton } from '@/components/ui/Skeleton';
import { MainArmfightHeroClient } from '@/components/armfight/MainArmfightHeroClient';

const SPORTS = [
  { slug: 'armwrestling', labelKey: 'armwrestling', icon: '💪' },
  { slug: 'mma', labelKey: 'mma', icon: '🥊' },
  { slug: 'boxing', labelKey: 'boxing', icon: '🥋' },
  { slug: 'jiu-jitsu', labelKey: 'jiu_jitsu', icon: '🤼' },
] as const;

const CATEGORY_KEYS: Record<string, 'news' | 'business' | 'sport'> = {
  news: 'news',
  business: 'business',
  sport: 'sport',
};

const CATEGORY_HREF: Record<string, string> = {
  news: '/news',
  business: '/business',
  sport: '/sport',
};

function HomeNewsCard({ item }: { item: NewsItem }) {
  const tNav = useTranslations('nav');
  const catKey = CATEGORY_KEYS[item.category];
  const catLabel = catKey ? tNav(catKey) : item.category;
  const catHref = CATEGORY_HREF[item.category] ?? '/news';

  return (
    <article className="border-t border-white/10 pt-5">
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0">
          <Link
            href={catHref}
            className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest mb-2 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-accent)' }}
          >
            {catLabel} ›
          </Link>
          <Link href={`/news/${item.slug}`} className="group block">
            <h3 className="text-lg font-black text-white leading-snug mb-2 group-hover:opacity-80 transition-opacity line-clamp-2">
              {item.title}
            </h3>
            {item.excerpt && (
              <p
                className="text-sm leading-relaxed line-clamp-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {item.excerpt}
              </p>
            )}
          </Link>
        </div>

        {item.coverImage && (
          <Link href={`/news/${item.slug}`} className="shrink-0 w-36 sm:w-48 block">
            <div className="relative aspect-[4/3] overflow-hidden">
              <Image
                src={item.coverImage}
                alt={item.title}
                fill
                className="object-cover hover:scale-[1.03] transition-transform duration-300"
              />
            </div>
          </Link>
        )}
      </div>
    </article>
  );
}

export default function HomePage() {
  const t = useTranslations('home');
  const tNav = useTranslations('nav');
  const tSport = useTranslations('sport');
  const { data: newsData, isLoading: newsLoading } = usePublicNews(undefined, 1);
  const latestNews = newsData?.items.slice(0, 4) ?? [];

  return (
    <div>
      {/* Hero */}
      <section
        className="relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0F0F1A 0%, #1A1A2E 50%, #0F0F1A 100%)' }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-24 sm:py-32 text-center">
          <div
            className="inline-block text-xs font-bold tracking-widest uppercase mb-6 px-4 py-2 rounded-full"
            style={{ backgroundColor: 'var(--color-primary)20', color: 'var(--color-primary)' }}
          >
            {t('badge')}
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-white leading-tight mb-6">
            GSM <span style={{ color: 'var(--color-primary)' }}>Sports</span>
          </h1>
          <p
            className="text-lg sm:text-xl max-w-2xl mx-auto mb-10"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('hero_subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/tournaments"
              className="px-8 py-4 rounded-2xl font-bold text-white text-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {t('tournaments')}
            </Link>
            <Link
              href="/news"
              className="px-8 py-4 rounded-2xl font-bold text-lg border border-white/20 hover:bg-white/5 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {tNav('news')}
            </Link>
          </div>
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(200,16,46,0.15) 0%, transparent 60%)',
          }}
        />
      </section>

      <MainArmfightHeroClient />

      {/* Sports */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-14">
        <h2
          className="text-xs font-black uppercase tracking-widest mb-6 border-b border-white/10 pb-3"
          style={{ color: 'var(--color-accent)' }}
        >
          {tNav('sports')}
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SPORTS.map((sport) => (
            <Link
              key={sport.slug}
              href={`/sport/${sport.slug}`}
              className="group rounded-xl border border-white/10 p-5 text-center hover:border-white/25 transition-all"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <div className="text-3xl mb-2">{sport.icon}</div>
              <div className="font-bold text-white text-sm group-hover:text-[var(--color-accent)] transition-colors">
                {tSport(sport.labelKey)}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Latest news — BBC style */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 pb-20">
        <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-0">
          <h2
            className="text-xs font-black uppercase tracking-widest"
            style={{ color: 'var(--color-accent)' }}
          >
            {t('latest_news')}
          </h2>
          <Link
            href="/news"
            className="text-xs font-semibold uppercase tracking-wider hover:text-white transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('all_news')} →
          </Link>
        </div>

        {newsLoading ? (
          <div className="space-y-6 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="border-t border-white/10 pt-5 flex gap-5">
                <div className="flex-1 space-y-3">
                  <Skeleton className="h-3 w-16 rounded" />
                  <Skeleton className="h-6 w-3/4 rounded" />
                  <Skeleton className="h-4 w-full rounded" />
                </div>
                <Skeleton className="w-36 aspect-[4/3] shrink-0" />
              </div>
            ))}
          </div>
        ) : !latestNews.length ? (
          <p
            className="text-center py-12 border-t border-white/10"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            {t('no_news')}
          </p>
        ) : (
          <div className="space-y-5 mt-1">
            {latestNews.map((item) => (
              <HomeNewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
