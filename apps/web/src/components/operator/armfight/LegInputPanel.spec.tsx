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
import { LegInputPanel } from './LegInputPanel';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const baseProps = {
  bracketId: 'bracket-1',
  boutId: 'wb_1_0',
  legIndex: 3,
  winner: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
  onClose: vi.fn(),
  onCommitted: vi.fn(),
};

describe('LegInputPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('renders the leg title with player name and index', () => {
    wrap(<LegInputPanel {...baseProps} />);
    expect(
      screen.getByText(/leg_input_title.*Иван Иванов.*3/),
    ).toBeInTheDocument();
  });

  it('starts with Pin pre-selected', () => {
    wrap(<LegInputPanel {...baseProps} />);
    expect(screen.getByRole('radio', { name: /wintype_pin/i })).toBeChecked();
    expect(screen.getByRole('radio', { name: /wintype_foul/i })).not.toBeChecked();
  });

  it('allows switching winType', () => {
    wrap(<LegInputPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /wintype_dq/i }));
    expect(screen.getByRole('radio', { name: /wintype_dq/i })).toBeChecked();
  });

  it('calls the mutation with the chosen winType on confirm', async () => {
    (api.post as any).mockResolvedValue({ data: {} });
    wrap(<LegInputPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('radio', { name: /wintype_foul/i }));
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(api.post).toHaveBeenCalled());
    expect(api.post).toHaveBeenCalledWith('/brackets/bracket-1/legs', {
      boutId: 'wb_1_0',
      legIndex: 3,
      winnerId: 'a',
      winType: 'foul',
    });
  });

  it('renders engine 400 message verbatim', async () => {
    (api.post as any).mockRejectedValue({
      response: {
        status: 400,
        data: { message: 'recordLeg: legIndex must be next-in-sequence (expected 4, got 3)' },
      },
    });
    wrap(<LegInputPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() =>
      expect(
        screen.getByText(/legIndex must be next-in-sequence/),
      ).toBeInTheDocument(),
    );
  });

  it('cancel calls onClose, not mutation', () => {
    wrap(<LegInputPanel {...baseProps} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(baseProps.onClose).toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });
});
