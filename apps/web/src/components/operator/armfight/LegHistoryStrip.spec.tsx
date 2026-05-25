// apps/web/src/components/operator/armfight/LegHistoryStrip.spec.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

import { LegHistoryStrip } from './LegHistoryStrip';

const playerA = { id: 'a', firstName: 'Иван' };
const playerB = { id: 'b', firstName: 'Пётр' };

describe('LegHistoryStrip', () => {
  it('renders five slots when no legs played', () => {
    const { container } = render(
      <LegHistoryStrip legs={[]} playerA={playerA} playerB={playerB} />,
    );
    expect(container.querySelectorAll('[data-leg-slot]')).toHaveLength(5);
  });

  it('marks filled slots with winner initial', () => {
    render(
      <LegHistoryStrip
        legs={[
          { index: 1, winnerId: 'a', winType: 'pin' },
          { index: 2, winnerId: 'b', winType: 'foul' },
        ]}
        playerA={playerA}
        playerB={playerB}
      />,
    );
    expect(screen.getAllByText('И')).toHaveLength(1);
    expect(screen.getAllByText('П')).toHaveLength(1);
  });

  it('renders the correction hint', () => {
    render(<LegHistoryStrip legs={[]} playerA={playerA} playerB={playerB} />);
    expect(
      screen.getByText('leg_history_correction_hint'),
    ).toBeInTheDocument();
  });
});
