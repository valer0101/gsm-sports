import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';

const replaceMock = vi.fn();
const searchParamsGet = vi.fn<(key: string) => string | null>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const apiGet = vi.fn();
vi.mock('@/lib/api', () => ({ api: { get: (...args: unknown[]) => apiGet(...args) } }));

import GoogleCallbackPage from './page';

const successPayload = {
  data: {
    id: 'u1',
    email: 'aram@example.com',
    firstName: 'Aram',
    lastName: 'Sargsyan',
    roles: ['user'],
    avatarUrl: null,
  },
};

beforeEach(() => {
  replaceMock.mockReset();
  apiGet.mockReset();
  searchParamsGet.mockReset().mockReturnValue(null);
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('GoogleCallbackPage', () => {
  it('hydrates the session from /auth/me and redirects to /admin by default', async () => {
    apiGet.mockResolvedValueOnce(successPayload);

    renderWithProviders(<GoogleCallbackPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/admin'));
    expect(apiGet).toHaveBeenCalledWith('/auth/me');
    const persisted = JSON.parse(window.localStorage.getItem('gsm_user') ?? '{}');
    expect(persisted).toMatchObject({ id: 'u1', email: 'aram@example.com' });
  });

  it('honours a same-origin ?redirect= when the API forwarded one back', async () => {
    apiGet.mockResolvedValueOnce(successPayload);
    searchParamsGet.mockImplementation((key) => (key === 'redirect' ? '/admin/foo' : null));

    renderWithProviders(<GoogleCallbackPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/admin/foo'));
  });

  it('falls back to /admin if redirect is an absolute URL', async () => {
    apiGet.mockResolvedValueOnce(successPayload);
    searchParamsGet.mockImplementation((key) =>
      key === 'redirect' ? 'https://evil.com/phish' : null,
    );

    renderWithProviders(<GoogleCallbackPage />);

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/admin'));
  });

  it('shows the failure card when the API redirected with status=error', async () => {
    searchParamsGet.mockImplementation((key) => (key === 'status' ? 'error' : null));

    renderWithProviders(<GoogleCallbackPage />);

    expect(await screen.findByText('google_failed_title')).toBeInTheDocument();
    expect(apiGet).not.toHaveBeenCalled();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('shows the failure card if /auth/me fails', async () => {
    apiGet.mockRejectedValueOnce(new Error('401'));

    renderWithProviders(<GoogleCallbackPage />);

    expect(await screen.findByText('google_failed_title')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
