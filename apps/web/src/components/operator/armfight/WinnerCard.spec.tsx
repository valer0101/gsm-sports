import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: Record<string, unknown>) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

import { WinnerCard } from './WinnerCard';

const winner = { id: 'a', firstName: 'Иван', lastName: 'Иванов' };

describe('WinnerCard', () => {
  it('renders completed state without walkover badge', () => {
    render(
      <WinnerCard
        winner={winner}
        scoreA={3}
        scoreB={1}
        status="completed"
        walkoverReason={null}
        backHref="/operator/tournaments/t1"
      />,
    );
    expect(screen.getByText(/Иван/)).toBeInTheDocument();
    expect(screen.queryByText('winner_card_walkover_badge')).toBeNull();
  });

  it('renders walkover badge and reason when present', () => {
    render(
      <WinnerCard
        winner={winner}
        scoreA={2}
        scoreB={0}
        status="walkover"
        walkoverReason="травма"
        backHref="/operator/tournaments/t1"
      />,
    );
    expect(screen.getByText('winner_card_walkover_badge')).toBeInTheDocument();
    expect(screen.getByText(/травма/)).toBeInTheDocument();
  });

  it('renders walkover badge without reason when reason is null', () => {
    render(
      <WinnerCard
        winner={winner}
        scoreA={0}
        scoreB={0}
        status="walkover"
        walkoverReason={null}
        backHref="/operator/tournaments/t1"
      />,
    );
    expect(screen.getByText('winner_card_walkover_badge')).toBeInTheDocument();
    expect(screen.queryByText(/winner_card_walkover_reason/)).toBeNull();
  });

  it('back link uses the provided href', () => {
    render(
      <WinnerCard
        winner={winner}
        scoreA={3}
        scoreB={0}
        status="completed"
        walkoverReason={null}
        backHref="/operator/tournaments/abc"
      />,
    );
    const link = screen.getByRole('link', { name: /back_to_card/i });
    expect(link).toHaveAttribute('href', '/operator/tournaments/abc');
  });
});
