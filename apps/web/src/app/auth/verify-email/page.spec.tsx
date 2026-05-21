import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import VerifyEmailPage from './page';
import { api } from '@/lib/api';
import messages from '@/messages/en.json';

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('token=' + 'a'.repeat(64)),
}));

vi.mock('@/lib/api', () => ({ api: { get: vi.fn() } }));

function wrap(ui: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <QueryClientProvider client={client}>{ui}</QueryClientProvider>
    </NextIntlClientProvider>
  );
}

describe('VerifyEmailPage', () => {
  it('shows success on 200', async () => {
    (api.get as any).mockResolvedValue({ data: { message: 'ok' } });
    render(wrap(<VerifyEmailPage />));
    expect(await screen.findByText(/email verified/i)).toBeInTheDocument();
  });

  it('shows error on 400', async () => {
    (api.get as any).mockRejectedValue({ response: { status: 400 } });
    render(wrap(<VerifyEmailPage />));
    await waitFor(() => expect(screen.getByText(/invalid or expired/i)).toBeInTheDocument());
  });
});
