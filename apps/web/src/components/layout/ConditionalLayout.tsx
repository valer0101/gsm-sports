'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';
import { SiteFooter } from './SiteFooter';
import { CookieBanner } from '../legal/CookieBanner';
import { EmailVerificationBannerSlot } from '../auth/EmailVerificationBannerSlot';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/operator');
  // OBS browser-source overlays and the arena projector view need the full
  // viewport without navbar / footer / wrapper background. Matches any
  // /tournaments/<slug>/broadcast/* or /tournaments/<slug>/arena page.
  const isFullScreen = /^\/tournaments\/[^/]+\/(broadcast|arena)(\/|$)/.test(pathname);
  // The verification banner is a logged-in nag; suppress it inside the
  // auth flow itself (otherwise it would render on top of /auth/verify-email
  // while the user is trying to verify). Mounting it on admin pages is
  // intentional — admins should see their own pending state too.
  const isAuthFlow = pathname.startsWith('/auth');

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
      {!isAuthFlow && <EmailVerificationBannerSlot />}
      {!isAdmin && <Navbar />}
      <main className="flex-1">{children}</main>
      {!isAdmin && <SiteFooter />}
      {!isAdmin && <CookieBanner />}
    </div>
  );
}
