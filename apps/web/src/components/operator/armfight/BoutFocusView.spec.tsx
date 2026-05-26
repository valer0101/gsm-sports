import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: any) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

vi.mock('@/lib/api', () => ({
  api: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('@/hooks/useBracketSocket', () => ({
  useBracketSocket: vi.fn(),
}));

import { api } from '@/lib/api';
import { BoutFocusView } from './BoutFocusView';
import type { BoutSnapshot } from './types';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const pendingBout: BoutSnapshot = {
  boutId: 'wb_1_0',
  order: 1,
  hand: 'right',
  playerA: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
  playerB: { id: 'b', firstName: 'Пётр', lastName: 'Петров' },
  scoreA: 0,
  scoreB: 0,
  status: 'pending',
  leadingId: null,
  legs: [],
  walkoverReason: null,
};

describe('BoutFocusView', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows the not-found panel when boutId is missing', async () => {
    (api.get as any).mockResolvedValue({ data: [pendingBout] });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_99"
        isLocked={false}
      />,
    );
    expect(await screen.findByText('error_bout_not_found')).toBeInTheDocument();
  });

  it('renders pending state with player buttons and Forfeit button', async () => {
    (api.get as any).mockResolvedValue({ data: [pendingBout] });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_0"
        isLocked={false}
      />,
    );
    expect(await screen.findByRole('button', { name: /Иван Иванов/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Пётр Петров/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forfeit_button/i }))
      .toBeInTheDocument();
  });

  it('opens LegInputPanel when a player button is tapped', async () => {
    (api.get as any).mockResolvedValue({ data: [pendingBout] });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_0"
        isLocked={false}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: /Иван Иванов/i }));
    expect(await screen.findByRole('dialog')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('leg_input_title'),
    );
  });

  it('renders WinnerCard when status is completed', async () => {
    (api.get as any).mockResolvedValue({
      data: [
        {
          ...pendingBout,
          scoreA: 3,
          scoreB: 1,
          status: 'completed',
          legs: [
            { index: 1, winnerId: 'a', winType: 'pin' },
            { index: 2, winnerId: 'a', winType: 'pin' },
            { index: 3, winnerId: 'b', winType: 'pin' },
            { index: 4, winnerId: 'a', winType: 'pin' },
          ],
        },
      ],
    });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_0"
        isLocked={false}
      />,
    );
    expect(
      await screen.findByText(/winner_card_title.*Иван Иванов/),
    ).toBeInTheDocument();
  });

  it('disables input when isLocked', async () => {
    (api.get as any).mockResolvedValue({ data: [pendingBout] });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_0"
        isLocked={true}
      />,
    );
    const ivanBtn = await screen.findByRole('button', { name: /Иван Иванов/i });
    expect(ivanBtn).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /forfeit_button/i }),
    ).toBeDisabled();
  });

  it('renders player buttons + scoreboard for in_progress status', async () => {
    (api.get as any).mockResolvedValue({
      data: [
        {
          ...pendingBout,
          scoreA: 1,
          scoreB: 0,
          status: 'in_progress',
          legs: [{ index: 1, winnerId: 'a', winType: 'pin' }],
        },
      ],
    });
    wrap(
      <BoutFocusView
        tournamentId="t1"
        bracketId="bracket-1"
        boutId="wb_1_0"
        isLocked={false}
      />,
    );
    // In-progress should still render the interactive UI, NOT WinnerCard
    expect(await screen.findByRole('button', { name: /Иван Иванов/i }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: /forfeit_button/i }))
      .toBeInTheDocument();
    // Score should reflect 1:0 — at least one element with text "1" in the scoreboard
    expect(screen.getAllByText('1').length).toBeGreaterThanOrEqual(1);
  });
});
