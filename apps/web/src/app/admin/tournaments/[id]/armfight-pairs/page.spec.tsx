import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/link', () => ({ default: ({ children, href }: any) => <a href={href}>{children}</a> }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const useAdminTournament = vi.fn();
const useConfirmedEntries = vi.fn();
const useArmfightBracket = vi.fn();
vi.mock('@/hooks/useAdmin', () => ({
  useAdminTournament: (...a: any[]) => useAdminTournament(...a),
  useConfirmedEntries: (...a: any[]) => useConfirmedEntries(...a),
  useArmfightBracket: (...a: any[]) => useArmfightBracket(...a),
  useGenerateArmfightBracket: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
  useResetBracket: () => ({ mutate: vi.fn(), isPending: false, isError: false }),
}));

// Render the inner view directly with a plain `id` — keeps the test free
// of Suspense / `use(params)` machinery (those live in the default export).
import { ArmfightPairsView } from './_view';

function setup({
  tournament,
  entries = [],
  bracket = null,
}: { tournament: any; entries?: any[]; bracket?: any }) {
  useAdminTournament.mockReturnValue({ data: tournament, isLoading: false });
  useConfirmedEntries.mockReturnValue({ data: { data: entries }, isLoading: false });
  useArmfightBracket.mockReturnValue({ data: bracket, isLoading: false });
  return render(<ArmfightPairsView id="t1" />);
}

// React 19's `use(params)` suspends until the promise resolves; tests use
// async `findByText` which retries until the next render cycle settles.
describe('ArmfightPairsPage', () => {
  it('state 1 — < 2 entries → EmptyEntriesState', async () => {
    setup({
      tournament: { id: 't1', format: 'armfight', bracketGenerated: false, status: 'upcoming' },
      entries: [],
    });
    expect(screen.getByText('empty_no_entries_title')).toBeInTheDocument();
  });

  it('state 2 — entries + no bracket → PairBuilder', async () => {
    setup({
      tournament: { id: 't1', format: 'armfight', bracketGenerated: false, status: 'active' },
      entries: [
        { id: 'e1', status: 'confirmed', user: { firstName: 'A', lastName: 'X' }, weightKg: 76, hand: 'right' },
        { id: 'e2', status: 'confirmed', user: { firstName: 'B', lastName: 'X' }, weightKg: 78, hand: 'right' },
      ],
      bracket: null,
    });
    expect(screen.getByText('roster_title')).toBeInTheDocument();
  });

  it('state 3 — bracket generated → PairsSummary with rebuild', async () => {
    setup({
      tournament: { id: 't1', format: 'armfight', bracketGenerated: true, status: 'active' },
      entries: [],
      bracket: {
        id: 'b1', bracketData: { format: 'armfight', winnersBracket: [[]] },
      },
    });
    expect(screen.getByText('pairs_title')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /rebuild_btn/i })).toBeInTheDocument();
  });

  it('state 4 — completed → PairsSummary without rebuild', async () => {
    setup({
      tournament: { id: 't1', format: 'armfight', bracketGenerated: true, status: 'completed' },
      entries: [],
      bracket: {
        id: 'b1', bracketData: { format: 'armfight', winnersBracket: [[]] },
      },
    });
    expect(screen.getByText('readonly_completed_note')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /rebuild_btn/i })).toBeNull();
  });

  it('non-armfight tournament → not-armfight panel', async () => {
    setup({
      tournament: { id: 't1', format: 'double_elim', bracketGenerated: false, status: 'active' },
      entries: [],
    });
    expect(screen.getByText('not_armfight_title')).toBeInTheDocument();
  });
});
