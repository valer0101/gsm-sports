import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

const mutate = vi.fn();
const useResetBracketMock = vi.fn(() => ({ mutate, isPending: false, isError: false, error: null }));
vi.mock('@/hooks/useAdmin', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useAdmin')>('@/hooks/useAdmin');
  return {
    ...actual,
    useResetBracket: (...args: any[]) => useResetBracketMock(...args),
  };
});

import { PairsSummary } from './PairsSummary';
import type { Bracket } from '@/types/api';

const makeBracket = (): Bracket => ({
  id: 'b1',
  tournamentId: 't1',
  weightCategoryId: null,
  status: 'active',
  isLocked: false,
  modificationCount: 0,
  lastModifiedBy: null,
  lastModifiedAt: null,
  completedAt: null,
  bracketData: {
    format: 'armfight',
    bracketSize: 4,
    wbRounds: 1,
    players: [],
    losersBracket: [],
    grandFinal: { id: 'gf' } as any,
    superFinal: { id: 'sf', needed: false } as any,
    champion: null,
    status: 'active',
    winnersBracket: [[
      {
        id: 'wb_1_0', round: 1, matchIndex: 0,
        player1: { id: 'p1', firstName: 'Levon', lastName: 'H', number: 1 },
        player2: { id: 'p2', firstName: 'Garik', lastName: 'P', number: 2 },
        winner: null, loser: null,
        result: { hand: 'right', legs: [], scoreA: 0, scoreB: 0, status: 'pending' } as any,
      } as any,
      {
        id: 'wb_1_1', round: 1, matchIndex: 1,
        player1: { id: 'p3', firstName: 'Artur', lastName: 'K', number: 3 },
        player2: { id: 'p4', firstName: 'Vahe', lastName: 'M', number: 4 },
        winner: null, loser: null,
        result: { hand: 'left', legs: [], scoreA: 0, scoreB: 0, status: 'pending' } as any,
      } as any,
    ]],
  } as any,
} as any);

describe('PairsSummary', () => {
  beforeEach(() => {
    mutate.mockClear();
    useResetBracketMock.mockClear();
  });

  it('renders one card per bout from winnersBracket[0]', () => {
    render(<PairsSummary tournamentId="t1" bracket={makeBracket()} canRebuild />);
    expect(screen.getByText(/Levon H/)).toBeInTheDocument();
    expect(screen.getByText(/Garik P/)).toBeInTheDocument();
    expect(screen.getByText(/Artur K/)).toBeInTheDocument();
    expect(screen.getByText(/Vahe M/)).toBeInTheDocument();
  });

  it('shows the rebuild button when canRebuild=true', () => {
    render(<PairsSummary tournamentId="t1" bracket={makeBracket()} canRebuild />);
    expect(screen.getByRole('button', { name: /rebuild_btn/i })).toBeInTheDocument();
  });

  it('hides the rebuild button when canRebuild=false', () => {
    render(<PairsSummary tournamentId="t1" bracket={makeBracket()} canRebuild={false} />);
    expect(screen.queryByRole('button', { name: /rebuild_btn/i })).toBeNull();
  });

  it('rebuild flow: click → confirm → mutate', () => {
    render(<PairsSummary tournamentId="t1" bracket={makeBracket()} canRebuild />);
    fireEvent.click(screen.getByRole('button', { name: /rebuild_btn/i }));
    // confirm modal visible
    expect(screen.getByText('rebuild_confirm_title')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /rebuild_confirm_yes/i }));
    expect(mutate).toHaveBeenCalledTimes(1);
  });
});
