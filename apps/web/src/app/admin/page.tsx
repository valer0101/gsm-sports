'use client';

import Link from 'next/link';
import { useAdminTournaments, useAdminUsers } from '@/hooks/useAdmin';
import { useAdminNews } from '@/hooks/useNews';
import { useCurrentUser } from '@/hooks/useCurrentUser';

function StatCard({
  label,
  value,
  href,
  color,
}: {
  label: string;
  value: number | string;
  href: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-white/10 p-6 hover:border-white/20 transition-all group"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <p className="text-sm mb-1" style={{ color: 'var(--color-text-secondary)' }}>
        {label}
      </p>
      <p className="text-3xl font-black" style={{ color }}>
        {value}
      </p>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const { data: user } = useCurrentUser();
  const { data: tournaments } = useAdminTournaments();
  const { data: users } = useAdminUsers();
  const { data: news } = useAdminNews();

  const isAdmin = user?.roles.includes('admin');

  const activeTournaments =
    tournaments?.filter((t) => ['active', 'registration_open', 'upcoming'].includes(t.status))
      .length ?? 0;

  const quickLinks = [
    { label: 'Создать турнир', href: '/admin/tournaments/new', icon: '🏆' },
    { label: 'Написать новость', href: '/admin/news/new', icon: '📰' },
    { label: 'Все турниры', href: '/admin/tournaments', icon: '📋' },
    ...(isAdmin ? [{ label: 'Пользователи', href: '/admin/users', icon: '👥' }] : []),
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-10">
        <h1 className="text-2xl font-black text-white">
          Добро пожаловать{user?.firstName ? `, ${user.firstName}` : ''}
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-text-secondary)' }}>
          Обзор платформы GSM Sports
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
        <StatCard
          label="Всего турниров"
          value={tournaments?.length ?? '—'}
          href="/admin/tournaments"
          color="var(--color-accent)"
        />
        <StatCard
          label="Активных"
          value={activeTournaments}
          href="/admin/tournaments"
          color="var(--color-success)"
        />
        <StatCard label="Новостей" value={news?.total ?? '—'} href="/admin/news" color="#60a5fa" />
        {isAdmin && (
          <StatCard
            label="Пользователей"
            value={users?.total ?? '—'}
            href="/admin/users"
            color="#c084fc"
          />
        )}
      </div>

      {/* Quick actions */}
      <div className="mb-10">
        <h2
          className="text-sm font-semibold uppercase tracking-wider mb-4"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Быстрые действия
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all text-sm font-medium text-white"
            >
              <span className="text-lg">{link.icon}</span>
              {link.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Recent tournaments */}
      {!!tournaments?.length && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-sm font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Последние турниры
            </h2>
            <Link
              href="/admin/tournaments"
              className="text-xs hover:text-white transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              Все →
            </Link>
          </div>
          <div
            className="rounded-2xl border border-white/10 overflow-hidden"
            style={{ backgroundColor: 'var(--color-secondary)' }}
          >
            {tournaments.slice(0, 5).map((tour, i) => (
              <div
                key={tour.id}
                className="flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition-colors"
                style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : undefined }}
              >
                <div>
                  <p className="text-sm font-semibold text-white">{tour.name}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
                    {new Date(tour.startDate).toLocaleDateString('ru-RU')}
                    {tour.location ? ` · ${tour.location}` : ''}
                  </p>
                </div>
                <Link
                  href={`/admin/tournaments/${tour.id}`}
                  className="text-xs px-3 py-1.5 rounded-lg border border-white/10 text-white hover:bg-white/10 transition-colors shrink-0"
                >
                  Открыть
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
