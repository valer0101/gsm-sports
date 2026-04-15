'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useNewsItem, useUpdateNews } from '@/hooks/useNews';
import { RichTextEditor } from '@/components/admin/RichTextEditor';
import { ImageUpload } from '@/components/admin/ImageUpload';
import { Skeleton } from '@/components/ui/Skeleton';

export default function EditNewsPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const { data: item, isLoading } = useNewsItem(id);
  const updateMutation = useUpdateNews(id);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [coverImage, setCoverImage] = useState('');
  const [category, setCategory] = useState('news');
  const [status, setStatus] = useState('draft');

  useEffect(() => {
    if (item) {
      setTitle(item.title);
      setContent(item.content);
      setExcerpt(item.excerpt ?? '');
      setCoverImage(item.coverImage ?? '');
      setCategory(item.category);
      setStatus(item.status);
    }
  }, [item]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(
      {
        title,
        content,
        excerpt: excerpt || undefined,
        coverImage: coverImage || undefined,
        category,
        status,
      },
      { onSuccess: () => router.push('/admin/news') },
    );
  };

  if (isLoading)
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-4">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-14 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Редактировать статью</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Заголовок *
          </label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors text-lg font-semibold"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Категория
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/15 text-white outline-none"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <option value="news">Новости</option>
              <option value="business">Бизнес</option>
              <option value="sport">Спорт</option>
            </select>
          </div>
          <div>
            <label
              className="block text-xs font-semibold uppercase tracking-wider mb-2"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Статус
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-white/15 text-white outline-none"
              style={{ backgroundColor: 'var(--color-secondary)' }}
            >
              <option value="draft">Черновик</option>
              <option value="published">Опубликовать</option>
            </select>
          </div>
        </div>

        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Краткое описание
          </label>
          <textarea
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
            className="w-full px-4 py-3 rounded-xl bg-transparent border border-white/15 text-white outline-none focus:border-[var(--color-accent)] transition-colors resize-none"
          />
        </div>

        <ImageUpload value={coverImage} onChange={setCoverImage} />

        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Содержание *
          </label>
          <RichTextEditor value={content} onChange={setContent} />
        </div>

        {updateMutation.isError && (
          <p className="text-sm text-red-400 bg-red-500/10 px-4 py-2.5 rounded-xl">
            Ошибка при сохранении
          </p>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending || !title || !content}
            className="px-6 py-3 rounded-xl font-bold text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-accent)' }}
          >
            {updateMutation.isPending ? 'Сохраняем...' : 'Сохранить'}
          </button>
          <button
            type="button"
            onClick={() => router.push('/admin/news')}
            className="px-6 py-3 rounded-xl font-medium border border-white/10 hover:bg-white/10 transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
}
