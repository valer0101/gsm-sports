import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

import { Countdown } from './Countdown';

describe('Countdown', () => {
  it('renders four padded boxes for a far-future target', () => {
    const future = new Date(Date.now() + 2 * 86400_000 + 3600_000).toISOString();
    render(<Countdown targetIso={future} />);
    expect(screen.getByTestId('cd-days')).toHaveTextContent('02');
    expect(screen.getByTestId('cd-hours')).toBeInTheDocument();
    expect(screen.getByTestId('cd-mins')).toBeInTheDocument();
    expect(screen.getByTestId('cd-secs')).toBeInTheDocument();
  });

  it('renders a LIVE badge instead of boxes once the target passed', () => {
    const past = new Date(Date.now() - 1000).toISOString();
    render(<Countdown targetIso={past} />);
    expect(screen.getByTestId('cd-live')).toBeInTheDocument();
  });
});
