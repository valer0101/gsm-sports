import Link from 'next/link';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';

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

async function getBusinessNews(page = 1) {
  const res = await fetch(`${API_URL}/news?category=business&page=${page}&limit=12`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return { items: [] as NewsItem[], total: 0 };
  return res.json() as Promise<{ items: NewsItem[]; total: number }>;
}

function BusinessCard({
  item,
  featured = false,
  readMore,
}: {
  item: NewsItem;
  featured?: boolean;
  readMore: string;
}) {
  if (featured) {
    return (
      <article className="border-t border-white/10 pt-6">
        <div className="flex flex-col md:flex-row gap-6 md:gap-10 items-start">
          <div className="flex-1 min-w-0">
            <span
              className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-widest mb-4"
              style={{ color: 'var(--color-accent)' }}
            >
              Бизнес
            </span>
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

export default async function BusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const t = await getTranslations('news');
  const { page: pageStr = '1' } = await searchParams;
  const page = Math.max(1, Number(pageStr) || 1);

  const data = await getBusinessNews(page);
  const totalPages = Math.ceil((data.total || 0) / 12) || 1;
  const [featured, ...rest] = data.items;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="border-b border-white/10 pb-5 mb-0">
        <h1 className="text-2xl font-black text-white uppercase tracking-wide">{t('cat_business')}</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          {t('business_subtitle')}
        </p>
      </div>

      {!data.items.length ? (
        <div className="text-center py-20">
          <p className="font-semibold text-white mb-2">{t('empty')}</p>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {t('business_empty_desc')}
          </p>
        </div>
      ) : (
        <div className="space-y-8 mt-1">
          {featured && <BusinessCard item={featured} featured readMore={t('read_more')} />}
          {rest.map((item) => (
            <BusinessCard key={item.id} item={item} readMore={t('read_more')} />
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-12 border-t border-white/10 pt-8">
          {page > 1 ? (
            <Link
              href={`/business?page=${page - 1}`}
              className="px-5 py-2.5 border border-white/20 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              ← {t('prev')}
            </Link>
          ) : (
            <span className="px-5 py-2.5 border border-white/20 text-sm font-semibold opacity-30 text-white">
              ← {t('prev')}
            </span>
          )}
          <span className="px-5 py-2.5 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link
              href={`/business?page=${page + 1}`}
              className="px-5 py-2.5 border border-white/20 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
            >
              {t('next')} →
            </Link>
          ) : (
            <span className="px-5 py-2.5 border border-white/20 text-sm font-semibold opacity-30 text-white">
              {t('next')} →
            </span>
          )}
        </div>
      )}
    </div>
  );
}
