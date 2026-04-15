'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCurrentUser, clearStoredUser } from '@/hooks/useCurrentUser';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'Dashboard', icon: '▪' },
  { href: '/admin/tournaments', label: 'Турниры', icon: '🏆', roles: ['admin', 'organizer'] },
  { href: '/admin/athletes', label: 'Спортсмены', icon: '🥊', roles: ['admin', 'organizer'] },
  { href: '/admin/news', label: 'Новости', icon: '📰', roles: ['admin', 'editor'] },
  { href: '/admin/business', label: 'Бизнес', icon: '💼', roles: ['admin', 'editor'] },
  { href: '/admin/users', label: 'Пользователи', icon: '👥', roles: ['admin'] },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { data: user } = useCurrentUser();
  const queryClient = useQueryClient();

  const roles = user?.roles ?? [];

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.roles || item.roles.some((r) => roles.includes(r)),
  );

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {});
    clearStoredUser();
    queryClient.setQueryData(['currentUser'], null);
    window.location.href = '/';
  };

  return (
    <aside
      className="w-56 shrink-0 flex flex-col min-h-screen border-r border-white/10"
      style={{ backgroundColor: '#0a0a12' }}
    >
      {/* Logo */}
      <div className="px-5 py-5 border-b border-white/10">
        <Link href="/" className="flex items-center gap-2">
          <span
            className="text-lg font-black tracking-wider"
            style={{ color: 'var(--color-primary)' }}
          >
            GSM
          </span>
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: '#ef444420', color: '#ef4444' }}
          >
            ADMIN
          </span>
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
              style={{
                backgroundColor: active ? 'var(--color-accent)' : 'transparent',
                color: active ? 'white' : 'var(--color-text-secondary)',
              }}
              onMouseEnter={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
              }}
              onMouseLeave={(e) => {
                if (!active) e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      <div className="px-3 py-4 border-t border-white/10 space-y-1">
        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all"
          style={{ color: 'var(--color-text-secondary)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span>←</span> На сайт
        </Link>
        {user && (
          <div className="px-3 py-2">
            <p className="text-xs font-semibold text-white">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-secondary)' }}>
              {user.email}
            </p>
          </div>
        )}
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all text-left"
          style={{ color: '#ef4444' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#ef444415';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <span>↩</span> Выйти
        </button>
      </div>
    </aside>
  );
}
