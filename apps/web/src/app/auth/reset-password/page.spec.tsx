import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import ResetPasswordPage from './page';
import { api } from '@/lib/api';
import messages from '@/messages/en.json';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams('token=' + 'a'.repeat(64)),
}));

vi.mock('@/lib/api', () => ({ api: { post: vi.fn() } }));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    (api.post as any).mockReset();
  });

  it('submits the token + password and shows success', async () => {
    (api.post as any).mockResolvedValue({ data: { message: 'ok' } });
    render(wrap(<ResetPasswordPage />));

    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[0], {
      target: { value: 'newPassword12' },
    });
    fireEvent.change(screen.getAllByPlaceholderText('••••••••')[1], {
      target: { value: 'newPassword12' },
    });
    fireEvent.click(screen.getByText(/save password/i));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'a'.repeat(64),
        password: 'newPassword12',
      });
    });
    expect(await screen.findByText(/password updated/i)).toBeInTheDocument();
  });
});
