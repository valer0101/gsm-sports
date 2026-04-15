'use client';

import { useState } from 'react';
import { useAdminUsers, useUpdateUserRoles, type AdminUser } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/Skeleton';

const ALL_ROLES = ['user', 'organizer', 'editor', 'admin'];

const ROLE_COLOR: Record<string, string> = {
  admin: '#ef4444',
  organizer: '#a855f7',
  editor: '#3b82f6',
  user: '#6b7280',
};

function RoleBadge({ role }: { role: string }) {
  const color = ROLE_COLOR[role] ?? '#6b7280';
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium"
      style={{ backgroundColor: color + '20', color }}
    >
      {role}
    </span>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(user.roles);
  const updateRoles = useUpdateUserRoles();

  const toggle = (role: string) => {
    setSelected((prev) => (prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]));
  };

  const save = () => {
    updateRoles.mutate({ id: user.id, roles: selected }, { onSuccess: () => setEditing(false) });
  };

  return (
    <tr className="border-b border-white/5 hover:bg-white/3 transition-colors">
      <td className="px-5 py-4">
        <p className="font-semibold text-white">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
          {user.email}
        </p>
      </td>
      <td className="px-4 py-4">
        {editing ? (
          <div className="flex flex-wrap gap-1.5">
            {ALL_ROLES.map((role) => (
              <button
                key={role}
                onClick={() => toggle(role)}
                className="text-xs px-2.5 py-1 rounded-full border transition-colors"
                style={{
                  borderColor: selected.includes(role) ? ROLE_COLOR[role] : 'rgba(255,255,255,0.1)',
                  backgroundColor: selected.includes(role)
                    ? ROLE_COLOR[role] + '20'
                    : 'transparent',
                  color: selected.includes(role) ? ROLE_COLOR[role] : 'var(--color-text-secondary)',
                }}
              >
                {role}
              </button>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {user.roles.map((r) => (
              <RoleBadge key={r} role={r} />
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-4 text-xs" style={{ color: 'var(--color-text-secondary)' }}>
        {new Date(user.createdAt).toLocaleDateString('ru-RU')}
      </td>
      <td className="px-5 py-4 text-right">
        {editing ? (
          <div className="flex gap-2 justify-end">
            <button
              onClick={save}
              disabled={updateRoles.isPending}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: 'var(--color-accent)', color: 'white' }}
            >
              {updateRoles.isPending ? '...' : 'Сохранить'}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setSelected(user.roles);
              }}
              className="text-xs px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/10 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Отмена
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors"
          >
            Роли
          </button>
        )}
      </td>
    </tr>
  );
}

export default function AdminUsersPage() {
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminUsers(page);

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-black text-white">Пользователи</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Управление ролями пользователей
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-center py-12" style={{ color: 'var(--color-text-secondary)' }}>
          Ошибка загрузки
        </p>
      ) : (
        <>
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
                  <th className="text-left px-5 py-3">Пользователь</th>
                  <th className="text-left px-4 py-3">Роли</th>
                  <th className="text-left px-4 py-3">Дата</th>
                  <th className="text-right px-5 py-3">Действия</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((user) => (
                  <UserRow key={user.id} user={user} />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white disabled:opacity-40 hover:bg-white/10 transition-colors"
              >
                ←
              </button>
              <span className="px-4 py-2 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg border border-white/10 text-sm text-white disabled:opacity-40 hover:bg-white/10 transition-colors"
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
