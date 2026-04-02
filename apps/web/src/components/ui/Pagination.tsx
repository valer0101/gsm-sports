'use client';

import { useTranslations } from 'next-intl';

interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, totalPages, onPageChange }: PaginationProps) {
  const t = useTranslations('common');

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 py-6">
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        className="px-4 py-2 rounded-lg text-sm font-medium border border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t('prev')}
      </button>

      <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
        {t('page')} <span className="font-semibold text-white">{page}</span> {t('of')}{' '}
        <span className="font-semibold text-white">{totalPages}</span>
      </span>

      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        className="px-4 py-2 rounded-lg text-sm font-medium border border-white/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-white/5"
        style={{ color: 'var(--color-text-secondary)' }}
      >
        {t('next')}
      </button>
    </div>
  );
}
