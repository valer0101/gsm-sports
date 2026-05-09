import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';

const searchParamsGet = vi.fn<(key: string) => string | null>();

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({ get: searchParamsGet }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

import { GoogleSignInButton } from './GoogleSignInButton';

beforeEach(() => {
  searchParamsGet.mockReset().mockReturnValue(null);
});

function getHref(): string {
  const link = screen.getByRole('link', { name: /continue_with_google/i });
  return link.getAttribute('href') ?? '';
}

describe('GoogleSignInButton', () => {
  it('points to the API auth/google endpoint by default', () => {
    renderWithProviders(<GoogleSignInButton />);
    expect(getHref()).toBe('http://localhost:4000/v1/auth/google');
  });

  it('forwards a same-origin redirect query through to the API', () => {
    searchParamsGet.mockImplementation((key) => (key === 'redirect' ? '/admin/foo' : null));
    renderWithProviders(<GoogleSignInButton />);
    const url = new URL(getHref());
    expect(url.pathname).toBe('/v1/auth/google');
    expect(url.searchParams.get('redirect')).toBe('/admin/foo');
  });

  it('drops absolute redirect URLs (open-redirect guard)', () => {
    searchParamsGet.mockImplementation((key) =>
      key === 'redirect' ? 'https://evil.com/phish' : null,
    );
    renderWithProviders(<GoogleSignInButton />);
    const url = new URL(getHref());
    expect(url.searchParams.get('redirect')).toBeNull();
  });

  it('drops protocol-relative redirects', () => {
    searchParamsGet.mockImplementation((key) =>
      key === 'redirect' ? '//evil.com/phish' : null,
    );
    renderWithProviders(<GoogleSignInButton />);
    const url = new URL(getHref());
    expect(url.searchParams.get('redirect')).toBeNull();
  });

  it('renders a custom label when provided', () => {
    renderWithProviders(<GoogleSignInButton label="Sign up with Google" />);
    expect(screen.getByRole('link', { name: 'Sign up with Google' })).toBeInTheDocument();
  });
});
