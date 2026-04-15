'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useNewsBySlug } from '@/hooks/useNews';
import { Skeleton } from '@/components/ui/Skeleton';

export default function NewsArticlePage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: article, isLoading, isError } = useNewsBySlug(slug);

  if (isLoading)
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 space-y-4">
        <Skeleton className="h-8 w-32 rounded-lg" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-2xl" />
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
    );

  if (isError || !article)
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-20 text-center">
        <p className="text-xl text-white mb-4">Статья не найдена</p>
        <Link
          href="/news"
          className="text-sm underline"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          ← Назад к новостям
        </Link>
      </div>
    );

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Back */}
      <Link
        href="/news"
        className="inline-flex items-center gap-2 text-sm mb-8 hover:text-white transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        ← Все новости
      </Link>

      {/* Meta */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ backgroundColor: 'var(--color-accent)20', color: 'var(--color-accent)' }}
        >
          {article.category === 'news'
            ? 'Новости'
            : article.category === 'business'
              ? 'Бизнес'
              : 'Спорт'}
        </span>
        {article.publishedAt && (
          <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            {new Date(article.publishedAt).toLocaleDateString('ru-RU', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        )}
      </div>

      {/* Title */}
      <h1 className="text-3xl sm:text-4xl font-black text-white leading-tight mb-6">
        {article.title}
      </h1>

      {/* Excerpt */}
      {article.excerpt && (
        <p
          className="text-lg mb-8 leading-relaxed"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          {article.excerpt}
        </p>
      )}

      {/* Cover */}
      {article.coverImage && (
        <div className="relative h-72 sm:h-96 rounded-2xl overflow-hidden mb-10">
          <Image src={article.coverImage} alt={article.title} fill className="object-cover" />
        </div>
      )}

      {/* Content */}
      <div className="news-content" dangerouslySetInnerHTML={{ __html: article.content }} />

      <style>{`
        .news-content h1 { font-size: 2rem; font-weight: 800; color: white; margin: 1.5rem 0 0.75rem; }
        .news-content h2 { font-size: 1.5rem; font-weight: 700; color: white; margin: 1.25rem 0 0.5rem; }
        .news-content h3 { font-size: 1.2rem; font-weight: 600; color: white; margin: 1rem 0 0.5rem; }
        .news-content p { color: rgba(255,255,255,0.85); line-height: 1.8; margin: 0.75rem 0; }
        .news-content ul, .news-content ol { color: rgba(255,255,255,0.85); padding-left: 1.5rem; margin: 0.75rem 0; }
        .news-content li { margin: 0.3rem 0; line-height: 1.7; }
        .news-content blockquote { border-left: 3px solid var(--color-accent); padding-left: 1.25rem; margin: 1rem 0; color: var(--color-text-secondary); font-style: italic; }
        .news-content a { color: var(--color-accent); text-decoration: underline; }
        .news-content img { max-width: 100%; border-radius: 12px; margin: 1rem 0; }
        .news-content strong { color: white; font-weight: 700; }
      `}</style>
    </article>
  );
}
