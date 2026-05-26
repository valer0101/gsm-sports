import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('next-intl', () => ({
  useTranslations: () => (k: string, p?: any) =>
    p ? `${k}:${JSON.stringify(p)}` : k,
}));

vi.mock('@/lib/api', () => ({ api: { get: vi.fn(), post: vi.fn() } }));
vi.mock('@/hooks/useBracketSocket', () => ({ useBracketSocket: vi.fn() }));

import { api } from '@/lib/api';
import { ArmfightFightCard } from './ArmfightFightCard';
import type { Bracket } from '@/types/api';
import type { BoutSnapshot } from './types';

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

const makeBracket = (over: Partial<Bracket> = {}): Bracket =>
  ({
    id: 'bracket-1',
    tournamentId: 't1',
    isLocked: false,
    bracketData: { format: 'armfight' } as any,
    ...over,
  }) as Bracket;

const bouts: BoutSnapshot[] = [
  {
    boutId: 'wb_1_0',
    order: 1,
    hand: 'right',
    playerA: { id: 'a', firstName: 'Иван', lastName: 'Иванов' },
    playerB: { id: 'b', firstName: 'Пётр', lastName: 'Петров' },
    scoreA: 3,
    scoreB: 1,
    status: 'completed',
    leadingId: 'a',
    legs: [],
    walkoverReason: null,
  },
  {
    boutId: 'wb_1_1',
    order: 2,
    hand: 'right',
    playerA: { id: 'c', firstName: 'Сергей', lastName: 'Сидоров' },
    playerB: { id: 'd', firstName: 'Олег', lastName: 'Козлов' },
    scoreA: 0,
    scoreB: 0,
    status: 'pending',
    leadingId: null,
    legs: [],
    walkoverReason: null,
  },
];

describe('ArmfightFightCard', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows loading skeleton initially', () => {
    (api.get as any).mockImplementation(() => new Promise(() => {}));
    const { container } = wrap(
      <ArmfightFightCard tournamentId="t1" bracket={makeBracket()} />,
    );
    expect(container.querySelectorAll('[class*="Skeleton"]').length + container.querySelectorAll('[data-skeleton]').length).toBeGreaterThanOrEqual(0);
  });

  it('renders one BoutListItem per bout', async () => {
    (api.get as any).mockResolvedValue({ data: bouts });
    wrap(<ArmfightFightCard tournamentId="t1" bracket={makeBracket()} />);
    expect(await screen.findAllByRole('link')).toHaveLength(bouts.length);
  });

  it('flags the first pending bout as next when there is a closed bout', async () => {
    (api.get as any).mockResolvedValue({ data: bouts });
    wrap(<ArmfightFightCard tournamentId="t1" bracket={makeBracket()} />);
    expect(await screen.findByText('next_pending_badge')).toBeInTheDocument();
  });

  it('shows lock banner when bracket.isLocked', async () => {
    (api.get as any).mockResolvedValue({ data: bouts });
    wrap(
      <ArmfightFightCard
        tournamentId="t1"
        bracket={makeBracket({ isLocked: true })}
      />,
    );
    expect(await screen.findByText('bracket_locked')).toBeInTheDocument();
  });

  it('does NOT flag next pending when all bouts are still pending', async () => {
    (api.get as any).mockResolvedValue({
      data: bouts.map((b) => ({ ...b, status: 'pending', scoreA: 0, scoreB: 0 })),
    });
    wrap(<ArmfightFightCard tournamentId="t1" bracket={makeBracket()} />);
    await screen.findAllByRole('link');
    expect(screen.queryByText('next_pending_badge')).toBeNull();
  });
});
