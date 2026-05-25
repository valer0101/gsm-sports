import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string) => k,
}));

import { Scoreboard } from './Scoreboard';

const playerA = { id: 'a', firstName: 'Иван', lastName: 'Иванов' };
const playerB = { id: 'b', firstName: 'Пётр', lastName: 'Петров' };

describe('Scoreboard', () => {
  it('renders both player names and the score', () => {
    render(
      <Scoreboard
        playerA={playerA}
        playerB={playerB}
        scoreA={2}
        scoreB={1}
        hand="right"
      />,
    );
    expect(screen.getByText(/Иван/)).toBeInTheDocument();
    expect(screen.getByText(/Пётр/)).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('renders the hand badge using the i18n key', () => {
    render(
      <Scoreboard
        playerA={playerA}
        playerB={playerB}
        scoreA={0}
        scoreB={0}
        hand="left"
      />,
    );
    expect(screen.getByText('hand_left')).toBeInTheDocument();
  });
});
