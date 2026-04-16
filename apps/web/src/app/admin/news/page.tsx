'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminNews, useDeleteNews, usePublishNewsItem, type NewsItem } from '@/hooks/useNews';
import { Skeleton } from '@/components/ui/Skeleton';

const STATUS_COLOR: Record<string, string> = {
  draft: '#6b7280',
  published: '#22c55e',
};

export default function AdminNewsPage() {
  const t = useTranslations('admin_news');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminNews(page);
  const deleteMutation = useDeleteNews();
  const publishMutation = usePublishNewsItem();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  const CATEGORY_LABEL: Record<string, string> = {
    news: t('cat_news'),
    business: t('cat_business'),
    sport: t('cat_sport'),
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">{t('page_title')}</h1>
          <p className="text-sm mt-1 text-[var(--color-text-secondary)]">{t('page_subtitle')}</p>
        </div>
        <Link
          href="/admin/news/new"
          className="px-4 py-2.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-90 bg-[var(--color-accent)] text-white"
        >
          {t('add_btn')}
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-center py-12 text-[var(--color-text-secondary)]">{t('error')}</p>
      ) : !data?.items.length ? (
        <div className="rounded-2xl border border-white/10 p-12 text-center bg-[var(--color-secondary)]">
          <p className="text-white font-semibold mb-2">{t('no_articles')}</p>
          <Link
            href="/admin/news/new"
            className="px-5 py-2.5 rounded-xl font-bold text-sm inline-block bg-[var(--color-accent)] text-white"
          >
            {t('create_first')}
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-[var(--color-secondary)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-white/10 text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">
                  <th className="text-left px-5 py-3">{t('col_title')}</th>
                  <th className="text-left px-4 py-3">{t('col_category')}</th>
                  <th className="text-left px-4 py-3">{t('col_status')}</th>
                  <th className="text-left px-4 py-3">{t('col_date')}</th>
                  <th className="text-right px-5 py-3">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {data.items.map((item: NewsItem) => {
                  const statusColor = STATUS_COLOR[item.status] ?? '#6b7280';
                  return (
                    <tr key={item.id} className="hover:bg-white/3 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-white line-clamp-1">{item.title}</p>
                        {item.excerpt && (
                          <p className="text-xs mt-0.5 line-clamp-1 text-[var(--color-text-secondary)]">
                            {item.excerpt}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                        {CATEGORY_LABEL[item.category] ?? item.category}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className="text-xs px-2.5 py-1 rounded-full font-medium"
                          style={{ backgroundColor: statusColor + '20', color: statusColor }}
                        >
                          {item.status === 'published' ? t('status_published_label') : t('status_draft_label')}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-sm text-[var(--color-text-secondary)]">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          {item.status === 'draft' && (
                            <button
                              onClick={() => publishMutation.mutate(item.id)}
                              disabled={publishMutation.isPending}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors bg-[#22c55e20] text-[#22c55e]"
                            >
                              {t('publish_btn')}
                            </button>
                          )}
                          <Link
                            href={`/admin/news/${item.id}`}
                            className="text-sm px-3 py-1.5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors"
                          >
                            {t('edit_btn')}
                          </Link>
                          {deleteConfirm === item.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() =>
                                  deleteMutation.mutate(item.id, {
                                    onSuccess: () => setDeleteConfirm(null),
                                  })
                                }
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30"
                              >
                                {t('delete_btn')}
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 text-[var(--color-text-secondary)]"
                              >
                                {t('cancel_delete')}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(item.id)}
                              className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10"
                            >
                              {t('delete_btn')}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white disabled:opacity-40 hover:bg-white/10"
              >
                ←
              </button>
              <span className="px-4 py-2 text-sm text-[var(--color-text-secondary)]">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white disabled:opacity-40 hover:bg-white/10"
              >
                →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
