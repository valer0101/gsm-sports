'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useAdminTournaments, useDeleteTournament } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/Skeleton';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Черновик', color: '#6b7280' },
  upcoming: { label: 'Предстоящий', color: '#3b82f6' },
  registration_open: { label: 'Регистрация открыта', color: '#22c55e' },
  registration_closed: { label: 'Регистрация закрыта', color: '#f59e0b' },
  bracket_ready: { label: 'Сетка готова', color: '#a855f7' },
  active: { label: 'Активный', color: '#ef4444' },
  completed: { label: 'Завершён', color: '#6b7280' },
  cancelled: { label: 'Отменён', color: '#6b7280' },
};

export default function AdminPage() {
  const { data: tournaments, isLoading } = useAdminTournaments();
  const deleteMutation = useDeleteTournament();
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-black text-white">Панель администратора</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
            Управление турнирами
          </p>
        </div>
        <Link
          href="/admin/tournaments/new"
          className="px-4 py-2.5 rounded-xl font-bold text-sm transition-opacity hover:opacity-90"
          style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
        >
          + Новый турнир
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 w-full rounded-xl" />
          ))}
        </div>
      ) : !tournaments?.length ? (
        <div
          className="rounded-2xl border border-white/10 p-12 text-center"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <p className="text-white font-semibold mb-2">Турниров пока нет</p>
          <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
            Создайте первый турнир
          </p>
          <Link
            href="/admin/tournaments/new"
            className="px-5 py-2.5 rounded-xl font-bold text-sm"
            style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
          >
            Создать турнир
          </Link>
        </div>
      ) : (
        <div
          className="rounded-2xl border border-white/10 overflow-hidden"
          style={{ backgroundColor: 'var(--color-secondary)' }}
        >
          <table className="w-full">
            <thead>
              <tr
                className="border-b border-white/10 text-xs uppercase tracking-wider"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                <th className="text-left px-5 py-3">Турнир</th>
                <th className="text-left px-4 py-3">Дата</th>
                <th className="text-left px-4 py-3">Статус</th>
                <th className="text-right px-5 py-3">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {tournaments.map((t) => {
                const st = STATUS_LABELS[t.status] ?? { label: t.status, color: '#6b7280' };
                return (
                  <tr key={t.id} className="hover:bg-white/3 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-white">{t.name}</p>
                      {t.location && (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: 'var(--color-text-secondary)' }}
                        >
                          {t.location}
                        </p>
                      )}
                    </td>
                    <td
                      className="px-4 py-4 text-sm"
                      style={{ color: 'var(--color-text-secondary)' }}
                    >
                      {new Date(t.startDate).toLocaleDateString('ru-RU')}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className="text-xs px-2.5 py-1 rounded-full font-medium"
                        style={{ backgroundColor: st.color + '20', color: st.color }}
                      >
                        {st.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2 justify-end">
                        <Link
                          href={`/admin/tournaments/${t.id}`}
                          className="text-sm px-3 py-1.5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors"
                        >
                          Управление
                        </Link>
                        {!['active', 'completed', 'cancelled'].includes(t.status) &&
                          (deleteConfirm === t.id ? (
                            <div className="flex gap-1">
                              <button
                                onClick={() => {
                                  deleteMutation.mutate(t.id, {
                                    onSuccess: () => setDeleteConfirm(null),
                                  });
                                }}
                                className="text-xs px-2.5 py-1.5 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                              >
                                Да, удалить
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-xs px-2.5 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
                                style={{ color: 'var(--color-text-secondary)' }}
                              >
                                Отмена
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(t.id)}
                              className="text-xs px-3 py-1.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                              Удалить
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
