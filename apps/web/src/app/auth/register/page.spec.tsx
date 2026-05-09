import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';

const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const apiPost = vi.fn();
vi.mock('@/lib/api', () => ({ api: { post: (...args: unknown[]) => apiPost(...args) } }));

import RegisterPage from './page';

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByPlaceholderText('first_name_placeholder'), 'Aram');
  await user.type(screen.getByPlaceholderText('last_name_placeholder'), 'Sargsyan');
  await user.type(screen.getByPlaceholderText('aram@example.com'), 'aram@example.com');
  // password + confirm share the bullet placeholder; pick by autocomplete attribute
  const passwordInputs = document.querySelectorAll<HTMLInputElement>(
    'input[autocomplete="new-password"]',
  );
  await user.type(passwordInputs[0], 'hunter2222');
  await user.type(passwordInputs[1], 'hunter2222');
}

beforeEach(() => {
  pushMock.mockReset();
  apiPost.mockReset();
});

describe('RegisterPage', () => {
  it('renders all required fields and the submit button', () => {
    renderWithProviders(<RegisterPage />);

    expect(screen.getByPlaceholderText('first_name_placeholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('last_name_placeholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('aram@example.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('+374 91 000000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'submit_register' })).toBeInTheDocument();
  });

  it('blocks submit and surfaces required-field errors when the form is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.click(screen.getByRole('button', { name: 'submit_register' }));

    // firstName + lastName + confirmPassword
    const required = await screen.findAllByText('field_required');
    expect(required.length).toBeGreaterThanOrEqual(3);
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('rejects an invalid email format', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    // Fill the rest of the form with valid values so the email rule is the
    // only failing check on submit.
    await user.type(screen.getByPlaceholderText('first_name_placeholder'), 'Aram');
    await user.type(screen.getByPlaceholderText('last_name_placeholder'), 'Sargsyan');
    await user.type(screen.getByPlaceholderText('aram@example.com'), 'not-an-email');
    const passwordInputs = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]',
    );
    await user.type(passwordInputs[0], 'hunter2222');
    await user.type(passwordInputs[1], 'hunter2222');
    await user.click(screen.getByRole('button', { name: 'submit_register' }));

    expect(await screen.findByText('error_invalid_email')).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('rejects passwords shorter than 8 characters', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByPlaceholderText('first_name_placeholder'), 'Aram');
    await user.type(screen.getByPlaceholderText('last_name_placeholder'), 'Sargsyan');
    await user.type(screen.getByPlaceholderText('aram@example.com'), 'aram@example.com');
    const passwordInputs = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]',
    );
    await user.type(passwordInputs[0], 'short');
    await user.type(passwordInputs[1], 'short');
    await user.click(screen.getByRole('button', { name: 'submit_register' }));

    expect(await screen.findByText('error_password_min')).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('rejects mismatched password and confirmation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await user.type(screen.getByPlaceholderText('first_name_placeholder'), 'Aram');
    await user.type(screen.getByPlaceholderText('last_name_placeholder'), 'Sargsyan');
    await user.type(screen.getByPlaceholderText('aram@example.com'), 'aram@example.com');
    const passwordInputs = document.querySelectorAll<HTMLInputElement>(
      'input[autocomplete="new-password"]',
    );
    await user.type(passwordInputs[0], 'hunter2222');
    await user.type(passwordInputs[1], 'mismatch00');
    await user.click(screen.getByRole('button', { name: 'submit_register' }));

    expect(await screen.findByText('error_passwords_mismatch')).toBeInTheDocument();
    expect(apiPost).not.toHaveBeenCalled();
  });

  it('omits an empty phone field from the request payload', async () => {
    apiPost.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'submit_register' }));

    await waitFor(() => expect(apiPost).toHaveBeenCalledTimes(1));
    const [, payload] = apiPost.mock.calls[0] as [string, Record<string, unknown>];
    expect(payload.phone).toBeUndefined();
    expect(payload).toMatchObject({
      firstName: 'Aram',
      lastName: 'Sargsyan',
      email: 'aram@example.com',
      password: 'hunter2222',
    });
    // confirmPassword must be stripped before sending
    expect(payload).not.toHaveProperty('confirmPassword');
  });

  it('redirects to "/" after a successful registration', async () => {
    apiPost.mockResolvedValue({ data: {} });
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'submit_register' }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith('/'));
  });

  it('joins an array of server validation errors into one message', async () => {
    apiPost.mockRejectedValue({
      response: { data: { message: ['email already taken', 'phone invalid'] } },
    });
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'submit_register' }));

    expect(await screen.findByText('email already taken, phone invalid')).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it('falls back to error_register when the server response has no message', async () => {
    apiPost.mockRejectedValue(new Error('network'));
    const user = userEvent.setup();
    renderWithProviders(<RegisterPage />);

    await fillValidForm(user);
    await user.click(screen.getByRole('button', { name: 'submit_register' }));

    expect(await screen.findByText('error_register')).toBeInTheDocument();
  });
});
