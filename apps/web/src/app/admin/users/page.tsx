'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAdminUsers, useUpdateUserRoles, type AdminUser } from '@/hooks/useAdmin';
import { Skeleton } from '@/components/ui/Skeleton';

const ALL_ROLES = ['user', 'organizer', 'admin'];

// Combat Energy semantic palette: admin → sport red (sacred — power user),
// organizer → gold accent (a featured/distinguished role), regular user →
// muted. Each badge is a soft tinted pill, not a solid colour block.
const ROLE_TOKEN: Record<string, { fg: string; bgRgba: string }> = {
  admin: { fg: 'var(--color-primary)', bgRgba: 'rgba(200,16,46,0.16)' },
  organizer: { fg: 'var(--color-accent)', bgRgba: 'rgba(255,215,0,0.14)' },
  user: { fg: 'var(--color-text-muted)', bgRgba: 'rgba(106,106,128,0.16)' },
};

function roleStyle(role: string) {
  return ROLE_TOKEN[role] ?? ROLE_TOKEN.user;
}

function RoleBadge({ role }: { role: string }) {
  const { fg, bgRgba } = roleStyle(role);
  return (
    <span
      className="text-[10px] uppercase tracking-[0.12em] px-2 py-0.5 rounded-full font-bold"
      style={{ backgroundColor: bgRgba, color: fg }}
    >
      {role}
    </span>
  );
}

function RolePicker({
  selected,
  onToggle,
}: {
  selected: string[];
  onToggle: (role: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ALL_ROLES.map((role) => {
        const active = selected.includes(role);
        const { fg, bgRgba } = roleStyle(role);
        return (
          <button
            key={role}
            type="button"
            onClick={() => onToggle(role)}
            className="text-[10px] uppercase tracking-[0.12em] px-2.5 py-1 rounded-full font-bold border transition-colors"
            style={{
              borderColor: active ? fg : 'var(--color-border)',
              backgroundColor: active ? bgRgba : 'transparent',
              color: active ? fg : 'var(--color-text-secondary)',
            }}
          >
            {role}
          </button>
        );
      })}
    </div>
  );
}

function UserRow({ user, t }: { user: AdminUser; t: ReturnType<typeof useTranslations> }) {
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
    <tr className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-2)] transition-colors">
      <td className="px-5 py-4">
        <p className="font-semibold text-[var(--color-text-primary)]">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs mt-0.5 text-[var(--color-text-secondary)]">{user.email}</p>
      </td>
      <td className="px-4 py-4">
        {editing ? (
          <RolePicker selected={selected} onToggle={toggle} />
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {user.roles.map((r) => (
              <RoleBadge key={r} role={r} />
            ))}
          </div>
        )}
      </td>
      <td className="px-4 py-4 text-xs text-[var(--color-text-secondary)] whitespace-nowrap">
        {new Date(user.createdAt).toLocaleDateString()}
      </td>
      <td className="px-5 py-4 text-right">
        {editing ? (
          <div className="flex gap-2 justify-end">
            <button
              onClick={save}
              disabled={updateRoles.isPending}
              className="text-xs px-3 py-1.5 rounded-md font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {updateRoles.isPending ? '...' : t('btn_save')}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setSelected(user.roles);
              }}
              className="text-xs px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {t('btn_cancel')}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-3 py-1.5 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
          >
            {t('btn_roles')}
          </button>
        )}
      </td>
    </tr>
  );
}

function UserCard({ user, t }: { user: AdminUser; t: ReturnType<typeof useTranslations> }) {
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
    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-[var(--color-text-primary)] truncate">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-xs mt-0.5 text-[var(--color-text-secondary)] truncate">{user.email}</p>
          <p className="text-[10px] mt-1 text-[var(--color-text-muted)]">
            {new Date(user.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {editing ? (
        <RolePicker selected={selected} onToggle={toggle} />
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {user.roles.map((r) => (
            <RoleBadge key={r} role={r} />
          ))}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        {editing ? (
          <>
            <button
              onClick={save}
              disabled={updateRoles.isPending}
              className="flex-1 text-sm px-3 py-2 rounded-md font-bold bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] disabled:opacity-50 transition-colors"
            >
              {updateRoles.isPending ? '...' : t('btn_save')}
            </button>
            <button
              onClick={() => {
                setEditing(false);
                setSelected(user.roles);
              }}
              className="flex-1 text-sm px-3 py-2 rounded-md border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {t('btn_cancel')}
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="flex-1 text-sm px-3 py-2 rounded-md border border-[var(--color-border)] text-[var(--color-text-primary)] hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
          >
            {t('btn_roles')}
          </button>
        )}
      </div>
    </div>
  );
}

export default function AdminUsersPage() {
  const t = useTranslations('admin_users');
  const [page, setPage] = useState(1);
  const { data, isLoading, isError } = useAdminUsers(page);

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-black text-[var(--color-text-primary)] tracking-tight">
          {t('title')}
        </h1>
        <p className="text-sm mt-1 text-[var(--color-text-secondary)]">{t('subtitle')}</p>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <p className="text-center py-12 text-[var(--color-text-secondary)]">{t('error')}</p>
      ) : (
        <>
          {/* Mobile: stacked cards */}
          <div className="md:hidden space-y-3">
            {data?.users.map((user) => (
              <UserCard key={user.id} user={user} t={t} />
            ))}
          </div>

          {/* Desktop: table */}
          <div className="hidden md:block rounded-xl border border-[var(--color-border)] overflow-hidden bg-[var(--color-surface)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
                  <th className="text-left px-5 py-3 font-bold">{t('col_user')}</th>
                  <th className="text-left px-4 py-3 font-bold">{t('col_roles')}</th>
                  <th className="text-left px-4 py-3 font-bold">{t('col_date')}</th>
                  <th className="text-right px-5 py-3 font-bold">{t('col_actions')}</th>
                </tr>
              </thead>
              <tbody>
                {data?.users.map((user) => (
                  <UserRow key={user.id} user={user} t={t} />
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-md border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] disabled:opacity-40 hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
              >
                ←
              </button>
              <span className="px-4 py-2 text-sm text-[var(--color-text-secondary)] tabular-nums">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-md border border-[var(--color-border)] text-sm text-[var(--color-text-primary)] disabled:opacity-40 hover:bg-[var(--color-surface-2)] hover:border-[var(--color-border-strong)] transition-colors"
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
