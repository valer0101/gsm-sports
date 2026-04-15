'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';
import { usePublicNews, type NewsItem } from '@/hooks/useNews';
import { Skeleton } from '@/components/ui/Skeleton';

const CATEGORIES = [
  { key: '', label: 'Все' },
  { key: 'news', label: 'Новости' },
  { key: 'business', label: 'Бизнес' },
  { key: 'sport', label: 'Спорт' },
];

const CATEGORY_HREF: Record<string, string> = {
  news: '/news',
  business: '/business',
  sport: '/sport',
};

function NewsCard({ item, featured = false }: { item: NewsItem; featured?: boolean }) {
  const categoryLabel = CATEGORIES.find((c) => c.key === item.category)?.label ?? item.category;
  const categoryHref = CATEGORY_HREF[item.category] ?? '/news';

  if (featured) {
    return (
      <article className="border-t border-white/10 pt-6">
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
          {/* Text */}
          <div className="flex-1 min-w-0">
            <Link
              href={categoryHref}
              className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest mb-4 hover:opacity-70 transition-opacity"
              style={{ color: 'var(--color-accent)' }}
            >
              {categoryLabel} ›
            </Link>
            <Link href={`/news/${item.slug}`} className="group block">
              <h2 className="text-2xl sm:text-3xl font-black text-white leading-tight mb-4 group-hover:opacity-80 transition-opacity">
                {item.title}
              </h2>
              {item.excerpt && (
                <p
                  className="text-base leading-relaxed mb-6"
                  style={{ color: 'var(--color-text-secondary)' }}
                >
                  {item.excerpt}
                </p>
              )}
              <span
                className="inline-block border px-4 py-2 text-sm font-semibold hover:bg-white/10 transition-colors"
                style={{
                  borderColor: 'rgba(255,255,255,0.3)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                Читать далее
              </span>
            </Link>
          </div>

          {/* Image */}
          {item.coverImage && (
            <Link href={`/news/${item.slug}`} className="w-full md:w-[55%] shrink-0 block">
              <div className="relative aspect-[16/9] overflow-hidden">
                <Image
                  src={item.coverImage}
                  alt={item.title}
                  fill
                  className="object-cover hover:scale-[1.02] transition-transform duration-500"
                />
              </div>
            </Link>
          )}
        </div>
      </article>
    );
  }

  return (
    <article className="border-t border-white/10 pt-5">
      <div className="flex gap-5 items-start">
        <div className="flex-1 min-w-0">
          <Link
            href={categoryHref}
            className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest mb-2 hover:opacity-70 transition-opacity"
            style={{ color: 'var(--color-accent)' }}
          >
            {categoryLabel} ›
          </Link>
          <Link href={`/news/${item.slug}`} className="group block">
            <h3 className="text-lg font-black text-white leading-snug mb-2 group-hover:opacity-80 transition-opacity line-clamp-3">
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
          {item.publishedAt && (
            <p
              className="text-xs mt-3"
              style={{ color: 'var(--color-text-secondary)', opacity: 0.6 }}
            >
              {new Date(item.publishedAt).toLocaleDateString('ru-RU', {
                day: 'numeric',
                month: 'long',
              })}
            </p>
          )}
        </div>

        {item.coverImage && (
          <Link href={`/news/${item.slug}`} className="shrink-0 w-32 sm:w-44 block">
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

function SkeletonCard({ featured = false }: { featured?: boolean }) {
  return (
    <div className="border-t border-white/10 pt-6">
      <div className={`flex ${featured ? 'flex-col md:flex-row' : 'flex-row'} gap-5`}>
        <div className="flex-1 space-y-3">
          <Skeleton className="h-3 w-16 rounded" />
          <Skeleton className={`h-8 w-full rounded ${featured ? 'md:w-3/4' : ''}`} />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-2/3 rounded" />
        </div>
        <Skeleton
          className={`rounded ${featured ? 'w-full md:w-[55%] aspect-video' : 'w-32 sm:w-44 aspect-[4/3]'} shrink-0`}
        />
      </div>
    </div>
  );
}

export default function NewsPage() {
  const [category, setCategory] = useState('');
  const [page, setPage] = useState(1);
  const { data, isLoading } = usePublicNews(category || undefined, page);

  const totalPages = data ? Math.ceil(data.total / 12) : 1;
  const [featured, ...rest] = data?.items ?? [];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-5">
        <h1 className="text-2xl font-black text-white uppercase tracking-wide">Новости</h1>
        <div className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => {
                setCategory(cat.key);
                setPage(1);
              }}
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all"
              style={{
                color: category === cat.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                borderBottom:
                  category === cat.key ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <SkeletonCard featured />
          {[1, 2, 3].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : !data?.items.length ? (
        <p className="text-center py-20" style={{ color: 'var(--color-text-secondary)' }}>
          Статей пока нет
        </p>
      ) : (
        <div className="space-y-8">
          {featured && <NewsCard item={featured} featured />}
          {rest.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-12 border-t border-white/10 pt-8">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-5 py-2.5 border border-white/20 text-sm font-semibold text-white disabled:opacity-30 hover:bg-white/10 transition-colors"
          >
            ← Назад
          </button>
          <span className="px-5 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-5 py-2.5 border border-white/20 text-sm font-semibold text-white disabled:opacity-30 hover:bg-white/10 transition-colors"
          >
            Вперёд →
          </button>
        </div>
      )}
    </div>
  );
}
