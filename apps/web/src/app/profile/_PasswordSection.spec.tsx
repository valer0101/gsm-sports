import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const useCurrentUserMock = vi.fn();
vi.mock('@/hooks/useCurrentUser', () => ({
  useCurrentUser: () => useCurrentUserMock(),
}));

const apiPost = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => apiPost(...args) } }));

import { PasswordSection } from './_PasswordSection';

const baseUser = {
  id: 'u1',
  email: 'aram@example.com',
  firstName: 'Aram',
  lastName: 'Sargsyan',
  roles: ['user'],
  avatarUrl: null,
};

beforeEach(() => {
  apiPost.mockReset();
  useCurrentUserMock.mockReset();
});

describe('PasswordSection', () => {
  it('renders the first-set form (no current password) for Google-only users', async () => {
    useCurrentUserMock.mockReturnValue({ data: { ...baseUser, hasPassword: false } });

    renderWithProviders(<PasswordSection />);

    expect(screen.getByText('first_set_description')).toBeInTheDocument();
    expect(screen.queryByText('current_password')).not.toBeInTheDocument();
    expect(screen.getByText('new_password')).toBeInTheDocument();
    expect(screen.getByText('confirm_password')).toBeInTheDocument();
  });

  it('renders the change-password form when the user already has a password', async () => {
    useCurrentUserMock.mockReturnValue({ data: { ...baseUser, hasPassword: true } });

    renderWithProviders(<PasswordSection />);

    expect(screen.getByText('change_description')).toBeInTheDocument();
    expect(screen.getByText('current_password')).toBeInTheDocument();
  });

  it('defaults to change-password mode when hasPassword is missing (cached older shape)', () => {
    useCurrentUserMock.mockReturnValue({ data: { ...baseUser } });

    renderWithProviders(<PasswordSection />);

    expect(screen.getByText('change_description')).toBeInTheDocument();
  });

  it('rejects mismatched passwords on the first-set form', async () => {
    useCurrentUserMock.mockReturnValue({ data: { ...baseUser, hasPassword: false } });
    const user = userEvent.setup();

    renderWithProviders(<PasswordSection />);

    const inputs = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]',
    );
    await user.type(inputs[0], 'newSecret123');
    await user.type(inputs[1], 'totallyDifferent');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('error_passwords_mismatch')).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('submits without currentPassword when first-setting a password', async () => {
    useCurrentUserMock.mockReturnValue({ data: { ...baseUser, hasPassword: false } });
    apiPost.mockResolvedValueOnce({ data: { message: 'Password updated' } });
    const user = userEvent.setup();

    renderWithProviders(<PasswordSection />);

    const inputs = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]',
    );
    await user.type(inputs[0], 'newSecret123');
    await user.type(inputs[1], 'newSecret123');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/auth/set-password', { password: 'newSecret123' }),
    );
    expect(await screen.findByText('saved')).toBeInTheDocument();
  });

  it('submits currentPassword + new password on the change form', async () => {
    useCurrentUserMock.mockReturnValue({ data: { ...baseUser, hasPassword: true } });
    apiPost.mockResolvedValueOnce({ data: { message: 'Password updated' } });
    const user = userEvent.setup();

    renderWithProviders(<PasswordSection />);

    const current = document.querySelector<HTMLInputElement>(
      'input[autocomplete="current-password"]',
    );
    expect(current).not.toBeNull();
    await user.type(current as HTMLInputElement, 'oldSecret123');

    const newInputs = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]',
    );
    await user.type(newInputs[0], 'newSecret123');
    await user.type(newInputs[1], 'newSecret123');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    await waitFor(() =>
      expect(apiPost).toHaveBeenCalledWith('/auth/set-password', {
        currentPassword: 'oldSecret123',
        password: 'newSecret123',
      }),
    );
  });

  it('surfaces a server-side error message in the form', async () => {
    useCurrentUserMock.mockReturnValue({ data: { ...baseUser, hasPassword: true } });
    apiPost.mockRejectedValueOnce({
      response: { data: { message: 'Invalid current password' } },
    });
    const user = userEvent.setup();

    renderWithProviders(<PasswordSection />);

    const current = document.querySelector<HTMLInputElement>(
      'input[autocomplete="current-password"]',
    );
    await user.type(current as HTMLInputElement, 'wrong');
    const newInputs = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]',
    );
    await user.type(newInputs[0], 'newSecret123');
    await user.type(newInputs[1], 'newSecret123');
    await user.click(screen.getByRole('button', { name: 'submit' }));

    expect(await screen.findByText('Invalid current password')).toBeInTheDocument();
  });
});
