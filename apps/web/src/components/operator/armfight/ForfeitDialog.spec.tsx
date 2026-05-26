import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: any) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

import { api } from '@/lib/api';
import { ForfeitDialog } from './ForfeitDialog';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const props = {
  bracketId: 'bracket-1',
  boutId: 'wb_1_0',
  boutOrder: 1,
  playerA: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
  playerB: { id: 'b', firstName: 'Пётр', lastName: 'Петров' },
  onClose: vi.fn(),
  onCommitted: vi.fn(),
};

describe('ForfeitDialog', () => {
  beforeEach(() => vi.clearAllMocks());

  it('confirm is disabled until a winner is selected', () => {
    wrap(<ForfeitDialog {...props} />);
    expect(screen.getByRole('button', { name: /confirm/i })).toBeDisabled();
    fireEvent.click(screen.getByRole('radio', { name: /Иван/i }));
    expect(screen.getByRole('button', { name: /confirm/i })).toBeEnabled();
  });

  it('submits with winnerId and trimmed reason', async () => {
    (api.post as any).mockResolvedValue({ data: {} });
    wrap(<ForfeitDialog {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: /Пётр/i }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: '  травма  ' },
    });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/brackets/bracket-1/forfeit', {
      boutId: 'wb_1_0',
      winnerId: 'b',
      walkoverReason: 'травма',
    });
  });

  it('submits without walkoverReason if textarea is empty/whitespace', async () => {
    (api.post as any).mockResolvedValue({ data: {} });
    wrap(<ForfeitDialog {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: /Иван/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect((api.post as any).mock.calls[0][1]).not.toHaveProperty(
      'walkoverReason',
    );
  });

  it('renders engine 400 verbatim', async () => {
    (api.post as any).mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'forfeitBout: bout already closed' },
      },
    });
    wrap(<ForfeitDialog {...props} />);
    fireEvent.click(screen.getByRole('radio', { name: /Иван/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(screen.getByText(/bout already closed/)).toBeInTheDocument(),
    );
  });
});
