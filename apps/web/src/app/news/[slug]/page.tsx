import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import DOMPurify from 'isomorphic-dompurify';
import { getTranslations } from 'next-intl/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1';

interface NewsArticle {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  coverImage: string | null;
  category: string;
  status: string;
  publishedAt: string | null;
}

async function getArticle(slug: string): Promise<NewsArticle | null> {
  const res = await fetch(`${API_URL}/news/${encodeURIComponent(slug)}`, {
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  return res.json();
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: 'Статья не найдена' };
  return {
    title: article.title,
    description: article.excerpt ?? undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      images: article.coverImage ? [article.coverImage] : [],
    },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = await getTranslations('news');
  const article = await getArticle(slug);

  if (!article) notFound();

  const categoryLabel =
    article.category === 'news'
      ? t('cat_news')
      : article.category === 'business'
        ? t('cat_business')
        : t('cat_sport');

  const safeContent = DOMPurify.sanitize(article.content, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'em', 's', 'u', 'h1', 'h2', 'h3', 'h4',
      'ul', 'ol', 'li', 'blockquote', 'a', 'img',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'target', 'rel'],
  });

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
      {/* Back */}
      <Link
        href="/news"
        className="inline-flex items-center gap-2 text-sm mb-8 hover:text-white transition-colors"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        ← {t('back_all')}
      </Link>

      {/* Meta */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="text-xs px-2.5 py-1 rounded-full font-medium"
          style={{ backgroundColor: 'var(--color-accent)20', color: 'var(--color-accent)' }}
        >
          {categoryLabel}
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

      {/* Content — sanitized HTML */}
      <div className="news-content" dangerouslySetInnerHTML={{ __html: safeContent }} />

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
