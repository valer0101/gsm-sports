import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const mutate = vi.fn();
const useGenerateArmfightBracketMock = vi.fn(() => ({
  mutate,
  isPending: false,
  isError: false,
  error: null,
}));
vi.mock('@/hooks/useAdmin', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useAdmin')>('@/hooks/useAdmin');
  return {
    ...actual,
    useGenerateArmfightBracket: (...args: any[]) => useGenerateArmfightBracketMock(...args),
  };
});

import { PairBuilder } from './PairBuilder';
import type { ConfirmedEntry } from '@/hooks/useAdmin';

const makeEntry = (id: string, name: string): ConfirmedEntry => ({
  id, status: 'confirmed', ageGroup: null, hand: 'right', weightKg: 80, seedNumber: null,
  user: { id: `u-${id}`, firstName: name, lastName: 'X', avatarUrl: null },
});

const entries = [
  makeEntry('e1', 'A'),
  makeEntry('e2', 'B'),
  makeEntry('e3', 'C'),
  makeEntry('e4', 'D'),
];

describe('PairBuilder', () => {
  beforeEach(() => {
    mutate.mockClear();
    useGenerateArmfightBracketMock.mockClear();
  });

  it('starts with one empty pair slot', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    expect(screen.getAllByText('pair_label').length).toBe(1);
  });

  it('+ Add pair grows the array', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    fireEvent.click(screen.getByRole('button', { name: /add_pair/i }));
    expect(screen.getAllByText('pair_label').length).toBe(2);
  });

  it('renders roster count from confirmed entries', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    // roster_count is rendered via t() — text passes through our mock
    expect(screen.getByText('roster_count')).toBeInTheDocument();
  });

  it('submit blocked when any pair is incomplete', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    const submit = screen.getByRole('button', { name: /^submit$/ });
    fireEvent.click(submit);
    expect(mutate).not.toHaveBeenCalled();
  });

  it('submit succeeds when all rows are complete', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'e1' } });
    fireEvent.change(selects[1], { target: { value: 'e2' } });
    fireEvent.change(selects[2], { target: { value: 'right' } });

    fireEvent.click(screen.getByRole('button', { name: /^submit$/ }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(mutate.mock.calls[0][0]).toEqual({
      pairs: [{ playerAId: 'e1', playerBId: 'e2', hand: 'right' }],
    });
  });

  it('shows unpaired warning when entries.length - pairs.length*2 > 0', () => {
    render(<PairBuilder tournamentId="t1" confirmedEntries={entries} />);
    // Fill one pair → 2 entries paired, 2 unpaired
    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], { target: { value: 'e1' } });
    fireEvent.change(selects[1], { target: { value: 'e2' } });
    fireEvent.change(selects[2], { target: { value: 'right' } });
    expect(screen.getByText('unpaired_warning')).toBeInTheDocument();
  });
});
