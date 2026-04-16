import Link from 'next/link';
import Image from 'next/image';
import { getTranslations, getLocale } from 'next-intl/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

interface NewsItem {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string;
  publishedAt: string | null;
}

async function getNews(category?: string, page = 1) {
  const url = `${API_URL}/news?page=${page}&limit=12${category ? `&category=${category}` : ''}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) return { items: [] as NewsItem[], total: 0 };
  return res.json() as Promise<{ items: NewsItem[]; total: number }>;
}

function NewsCard({
  item,
  featured = false,
  readMore,
  locale,
}: {
  item: NewsItem;
  featured?: boolean;
  readMore: string;
  locale: string;
}) {
  if (featured) {
    return (
      <article className="border-t border-white/10 pt-6">
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
          <div className="flex-1 min-w-0">
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
                style={{ borderColor: 'rgba(255,255,255,0.3)', color: 'var(--color-text-secondary)' }}
              >
                {readMore}
              </span>
            </Link>
          </div>
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
              {new Date(item.publishedAt).toLocaleDateString(locale, {
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

export default async function NewsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const t = await getTranslations('news');
  const locale = await getLocale();
  const { category = '', page: pageStr = '1' } = await searchParams;
  const page = Math.max(1, Number(pageStr) || 1);

  const data = await getNews(category || undefined, page);
  const totalPages = Math.ceil((data.total || 0) / 12) || 1;
  const [featured, ...rest] = data.items;

  const CATEGORIES = [
    { key: '', label: t('cat_all') },
    { key: 'news', label: t('cat_news') },
    { key: 'business', label: t('cat_business') },
    { key: 'sport', label: t('cat_sport') },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-5">
        <h1 className="text-2xl font-black text-white uppercase tracking-wide">{t('page_title')}</h1>
        <div className="flex gap-1">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.key}
              href={cat.key ? `/news?category=${cat.key}` : '/news'}
              className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all"
              style={{
                color: category === cat.key ? 'var(--color-accent)' : 'var(--color-text-secondary)',
                borderBottom:
                  category === cat.key ? '2px solid var(--color-accent)' : '2px solid transparent',
              }}
            >
              {cat.label}
            </Link>
          ))}
        </div>
      </div>

      {!data.items.length ? (
        <p className="text-center py-20" style={{ color: 'var(--color-text-secondary)' }}>
          {t('empty')}
        </p>
      ) : (
        <div className="space-y-8">
          {featured && <NewsCard item={featured} featured readMore={t('read_more')} locale={locale} />}
          {rest.map((item) => (
            <NewsCard key={item.id} item={item} readMore={t('read_more')} locale={locale} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-12 border-t border-white/10 pt-8">
          {page > 1 ? (
            <Link
              href={`/news?${category ? `category=${category}&` : ''}page=${page - 1}`}
              className="px-5 py-2.5 border border-white/20 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              ← {t('prev')}
            </Link>
          ) : (
            <span className="px-5 py-2.5 border border-white/20 text-sm font-semibold text-white opacity-30">
              ← {t('prev')}
            </span>
          )}
          <span className="px-5 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/news?${category ? `category=${category}&` : ''}page=${page + 1}`}
              className="px-5 py-2.5 border border-white/20 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              {t('next')} →
            </Link>
          ) : (
            <span className="px-5 py-2.5 border border-white/20 text-sm font-semibold text-white opacity-30">
              {t('next')} →
            </span>
          )}
        </div>
      )}
    </div>
  );
}
