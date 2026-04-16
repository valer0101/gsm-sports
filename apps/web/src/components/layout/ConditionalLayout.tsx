'use client';

import { usePathname } from 'next/navigation';
import { Navbar } from './Navbar';

export function ConditionalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith('/admin') || pathname.startsWith('/operator');

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
      {!isAdmin && (
        <footer
          className="border-t border-white/10 py-6 text-center text-sm"
          style={{
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-secondary)',
          }}
        >
          © {new Date().getFullYear()} GSM Sports. All rights reserved.
        </footer>
      )}
    </div>
  );
}
