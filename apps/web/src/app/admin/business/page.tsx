'use client';

import Link from 'next/link';

export default function AdminBusinessPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Бизнес</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Управление бизнес контентом
        </p>
      </div>

      <div
        className="rounded-2xl border border-white/10 p-12 text-center"
        style={{ backgroundColor: 'var(--color-secondary)' }}
      >
        <p className="text-white font-semibold mb-2">Раздел в разработке</p>
        <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
          Бизнес статьи создаются через раздел Новости с категорией "Бизнес"
        </p>
        <Link
          href="/admin/news/new"
          className="px-5 py-2.5 rounded-xl font-bold text-sm inline-block"
          style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
        >
          Создать статью
        </Link>
      </div>
    </div>
  );
}
