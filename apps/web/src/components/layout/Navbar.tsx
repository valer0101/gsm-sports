'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const NAV_LINKS = [
  { key: 'home', href: '/' },
  { key: 'sport', href: '/sport' },
  { key: 'business', href: '/business' },
] as const;

export function Navbar() {
  const t = useTranslations('nav');
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="sticky top-0 z-50 border-b border-white/10"
      style={{ backgroundColor: 'var(--color-secondary)' }}
    >
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <span
              className="text-xl font-black tracking-wider"
              style={{ color: 'var(--color-primary)' }}
            >
              GSM
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                className="text-sm font-medium transition-colors hover:text-white"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t(key)}
              </Link>
            ))}
          </div>

          {/* Auth buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              href="/auth/login"
              className="text-sm font-medium px-4 py-2 rounded-lg transition-colors hover:text-white"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              {t('login')}
            </Link>
            <Link
              href="/auth/register"
              className="text-sm font-semibold px-4 py-2 rounded-lg text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: 'var(--color-primary)' }}
            >
              {t('register')}
            </Link>
          </div>

          {/* Mobile burger */}
          <button
            className="md:hidden p-2 rounded-lg text-white"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {menuOpen ? (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              ) : (
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/10 py-4 space-y-1">
            {NAV_LINKS.map(({ key, href }) => (
              <Link
                key={key}
                href={href}
                className="block px-3 py-2 rounded-lg text-sm font-medium transition-colors hover:bg-white/5"
                style={{ color: 'var(--color-text-secondary)' }}
                onClick={() => setMenuOpen(false)}
              >
                {t(key)}
              </Link>
            ))}
            <div className="pt-3 flex flex-col gap-2 px-3">
              <Link
                href="/auth/login"
                className="text-sm font-medium py-2"
                style={{ color: 'var(--color-text-secondary)' }}
              >
                {t('login')}
              </Link>
              <Link
                href="/auth/register"
                className="text-sm font-semibold px-4 py-2 rounded-lg text-white text-center"
                style={{ backgroundColor: 'var(--color-primary)' }}
              >
                {t('register')}
              </Link>
            </div>
          </div>
        )}
      </nav>
    </header>
  );
}
