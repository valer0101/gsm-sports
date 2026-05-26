import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: any) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

import { BoutListItem } from './BoutListItem';
import type { BoutSnapshot } from './types';

const base: BoutSnapshot = {
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

describe('BoutListItem', () => {
  it('renders Link to bout focus URL', () => {
    render(<BoutListItem bout={base} tournamentId="t1" isNextPending={false} locked={false} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute(
      'href',
      '/operator/tournaments/t1/bouts/wb_1_0',
    );
  });

  it('shows status_pending for pending bout', () => {
    render(<BoutListItem bout={base} tournamentId="t1" isNextPending={false} locked={false} />);
    expect(screen.getByText('status_pending')).toBeInTheDocument();
  });

  it('shows score for in_progress bout', () => {
    render(
      <BoutListItem
        bout={{ ...base, status: 'in_progress', scoreA: 2, scoreB: 1 }}
        tournamentId="t1"
        isNextPending={false}
        locked={false}
      />,
    );
    expect(screen.getByText(/status_in_progress/)).toBeInTheDocument();
    expect(screen.getByText('2:1')).toBeInTheDocument();
  });

  it('shows winner for completed bout', () => {
    render(
      <BoutListItem
        bout={{ ...base, status: 'completed', scoreA: 3, scoreB: 1 }}
        tournamentId="t1"
        isNextPending={false}
        locked={false}
      />,
    );
    expect(screen.getByText(/status_completed/)).toBeInTheDocument();
  });

  it('shows walkover badge', () => {
    render(
      <BoutListItem
        bout={{ ...base, status: 'walkover', scoreA: 0, scoreB: 0 }}
        tournamentId="t1"
        isNextPending={false}
        locked={false}
      />,
    );
    expect(screen.getByText(/status_walkover/)).toBeInTheDocument();
  });

  it('shows next-pending badge when flagged', () => {
    render(<BoutListItem bout={base} tournamentId="t1" isNextPending={true} locked={false} />);
    expect(screen.getByText('next_pending_badge')).toBeInTheDocument();
  });
});
