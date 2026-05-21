import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import ForgotPasswordPage from './page';
import { api } from '@/lib/api';
import messages from '@/messages/en.json';

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn() },
}));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    (api.post as any).mockReset();
  });

  it('submits the email and shows success state', async () => {
    (api.post as any).mockResolvedValue({ data: { message: 'ok' } });
    render(wrap(<ForgotPasswordPage />));

    fireEvent.change(screen.getByPlaceholderText(/example/i), {
      target: { value: 'aram@example.com' },
    });
    fireEvent.click(screen.getByText(/send link/i));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/forgot-password', {
        email: 'aram@example.com',
      });
    });
    expect(await screen.findByText(/email sent/i)).toBeInTheDocument();
  });
});
