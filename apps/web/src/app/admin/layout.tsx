'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AdminSidebar } from '@/components/admin/AdminSidebar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[var(--color-background)]">
      {/* Mobile top bar — only visible below md */}
      <header className="md:hidden fixed top-0 inset-x-0 z-30 h-12 flex items-center justify-between px-3 bg-[var(--color-background)] border-b border-[var(--color-border)]">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          className="p-2 -ml-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <line x1="4" y1="7" x2="20" y2="7" />
            <line x1="4" y1="12" x2="20" y2="12" />
            <line x1="4" y1="17" x2="20" y2="17" />
          </svg>
        </button>
        <Link href="/admin" className="flex items-center gap-2">
          <span className="text-base font-black tracking-wider text-[var(--color-primary)]">GSM</span>
          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded text-[var(--color-error)] bg-[var(--color-error)]/15">
            Admin
          </span>
        </Link>
        <span className="w-6" aria-hidden />
      </header>

      {/* Backdrop — closes the drawer on mobile when open */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
        />
      )}

      <AdminSidebar open={open} onClose={() => setOpen(false)} />

      <main className="flex-1 overflow-auto pt-12 md:pt-0">{children}</main>
    </div>
  );
}
