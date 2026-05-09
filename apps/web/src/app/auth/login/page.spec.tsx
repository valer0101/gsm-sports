import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';

const pushMock = vi.fn();
const searchParamsGet = vi.fn<(key: string) => string | null>();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => ({ get: searchParamsGet }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const apiPost = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => apiPost(...args) } }));

import LoginPage from './page';

const successResponse = {
  data: {
    accessToken: 't',
    user: {
      id: 'u1',
      email: 'aram@example.com',
      firstName: 'Aram',
      lastName: 'Sargsyan',
      roles: ['user'],
    },
  },
};

beforeEach(() => {
  pushMock.mockReset();
  searchParamsGet.mockReset().mockReturnValue(null);
  apiPost.mockReset();
  window.localStorage.clear();
});

afterEach(() => {
  window.localStorage.clear();
});

describe('LoginPage', () => {
  it('renders login + password fields and the submit button', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByPlaceholderText('login_placeholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'submit_login' })).toBeInTheDocument();
  });

  it('shows required-field errors when submitting an empty form and does not call the API', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.click(screen.getByRole('button', { name: 'submit_login' }));

    const errors = await screen.findAllByText('field_required');
    expect(errors).toHaveLength(2);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('submits credentials, persists the user, and redirects to /admin by default', async () => {
    apiPost.mockResolvedValue(successResponse);
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText('login_placeholder'), 'aram@example.com');
    await user.type(screen.getByPlaceholderText('••••••••'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'submit_login' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    expect(apiPost).toHaveBeenCalledWith('/auth/login', {
      login: 'aram@example.com',
      password: 'hunter22',
    });
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin'));

    const persisted = JSON.parse(window.localStorage.getItem('gsm_user') ?? '{}');
    expect(persisted).toMatchObject({ id: 'u1', email: 'aram@example.com', roles: ['user'] });
  });

  it('honours a same-origin ?redirect param after a successful login', async () => {
    searchParamsGet.mockImplementation((key) => (key === 'redirect' ? '/admin/tournaments' : null));
    apiPost.mockResolvedValue(successResponse);
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText('login_placeholder'), 'aram');
    await user.type(screen.getByPlaceholderText('••••••••'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'submit_login' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin/tournaments'));
  });

  it('rejects a protocol-relative redirect target and falls back to /admin', async () => {
    searchParamsGet.mockImplementation((key) => (key === 'redirect' ? '//evil.example.com' : null));
    apiPost.mockResolvedValue(successResponse);
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText('login_placeholder'), 'aram');
    await user.type(screen.getByPlaceholderText('••••••••'), 'hunter22');
    await user.click(screen.getByRole('button', { name: 'submit_login' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/admin'));
    expect(pushMock).not.toHaveBeenCalledWith('//evil.example.com');
  });

  it('shows the server error message on a failed login', async () => {
    apiPost.mockRejectedValue({ response: { data: { message: 'Invalid credentials' } } });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText('login_placeholder'), 'aram');
    await user.type(screen.getByPlaceholderText('••••••••'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'submit_login' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(window.localStorage.getItem('gsm_user')).toBeNull();
  });

  it('falls back to error_invalid when the server provides no message', async () => {
    apiPost.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByPlaceholderText('login_placeholder'), 'aram');
    await user.type(screen.getByPlaceholderText('••••••••'), 'pw');
    await user.click(screen.getByRole('button', { name: 'submit_login' }));

    expect(await screen.findByText('error_invalid')).toBeInTheDocument();
  });
});
