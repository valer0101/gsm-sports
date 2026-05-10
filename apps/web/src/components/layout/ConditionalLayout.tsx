'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { SiteFooter } from './SiteFooter';
import { CookieBanner } from '../legal/CookieBanner';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/operator');
  // OBS browser-source overlays and the arena projector view need the full
  // viewport without navbar / footer / wrapper background. Matches any
  // /tournaments/<slug>/broadcast/* or /tournaments/<slug>/arena page.
  const isFullScreen = /^\/tournaments\/[^/]+\/(broadcast|arena)(\/|$)/.test(pathname);

  if (isFullScreen) {
    // No chrome, no wrapper background — the page itself controls the
    // root surface so `?bg=transparent` produces a true-transparent
    // browser source.
    return <main>{children}</main>;
  }

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        backgroundColor: 'var(--color-background)',
        color: 'var(--color-text-primary)',
      }}
    >
      {!isAdmin && <Navbar />}
      <main className="flex-1">{children}</main>
      {!isAdmin && <SiteFooter />}
      {!isAdmin && <CookieBanner />}
    </div>
  );
}
