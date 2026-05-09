'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
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

export interface AdminSidebarProps {
  open?: boolean;
  onClose?: () => void;
}

export function AdminSidebar({ open = false, onClose }: AdminSidebarProps) {
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

  // Lock body scroll while the mobile drawer is open. No-op on md+ where the
  // sidebar is always docked and `open` stays false from the layout.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Close drawer on Escape (mobile only — onClose isn't wired on desktop).
  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const handleLogout = async () => {
    await api.post('/auth/logout').catch(() => {});
    clearStoredUser();
    queryClient.setQueryData(['currentUser'], null);
    window.location.href = '/';
  };

  // Tap a nav link in the mobile drawer → close it after navigation.
  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <aside
      className={[
        // Mobile: fixed overlay drawer, slides in from the left.
        'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col border-r border-white/10 transition-transform duration-200 ease-out',
        // Desktop: docked, takes its natural place in the layout flex row.
        'md:static md:w-56 md:max-w-none md:translate-x-0 md:transition-none',
        open ? 'translate-x-0' : '-translate-x-full',
      ].join(' ')}
      style={{ backgroundColor: '#0a0a12' }}
      aria-hidden={!open ? 'true' : undefined}
    >
      {/* Logo + mobile close */}
      <div className="px-5 py-5 border-b border-white/10 flex items-center justify-between gap-2">
        <Link href="/" className="flex items-center gap-2" onClick={handleNavClick}>
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
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation"
            className="md:hidden p-1 -mr-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {visibleItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
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
          onClick={handleNavClick}
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
