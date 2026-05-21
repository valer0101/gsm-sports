import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));

import { PairRow } from './PairRow';
import type { ConfirmedEntry } from '@/hooks/useAdmin';

const makeEntry = (id: string, name: string, kg: number, hand: 'left'|'right'): ConfirmedEntry => ({
  id, status: 'confirmed', ageGroup: null, hand, weightKg: kg, seedNumber: null,
  user: { id: `u-${id}`, firstName: name, lastName: 'X', avatarUrl: null },
});

const entries = [
  makeEntry('e1', 'Levon', 76, 'right'),
  makeEntry('e2', 'Garik', 78, 'right'),
  makeEntry('e3', 'Artur', 82, 'left'),
];

const emptyValue = { id: 'd1', playerAId: '' as const, playerBId: '' as const, hand: '' as const };

describe('PairRow', () => {
  it('renders three selects + a remove button', () => {
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={() => {}} onRemove={() => {}} />,
    );
    // 2 player selects + 1 hand select
    expect(screen.getAllByRole('combobox')).toHaveLength(3);
    expect(screen.getByRole('button', { name: /remove_pair/i })).toBeInTheDocument();
  });

  it('shows entry options as "Name · weight · hand"', () => {
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={() => {}} onRemove={() => {}} />,
    );
    // Each entry label appears in both player A and player B selects.
    expect(screen.getAllByText('Levon X · 76kg · R')).toHaveLength(2);
    expect(screen.getAllByText('Artur X · 82kg · L')).toHaveLength(2);
  });

  it('calls onChange when playerA is picked', () => {
    const onChange = vi.fn();
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={onChange} onRemove={() => {}} />,
    );
    const [playerASelect] = screen.getAllByRole('combobox');
    fireEvent.change(playerASelect, { target: { value: 'e1' } });
    expect(onChange).toHaveBeenCalledWith({ ...emptyValue, playerAId: 'e1' });
  });

  it('calls onChange when hand is picked', () => {
    const onChange = vi.fn();
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={onChange} onRemove={() => {}} />,
    );
    const selects = screen.getAllByRole('combobox');
    const handSelect = selects[2];
    fireEvent.change(handSelect, { target: { value: 'left' } });
    expect(onChange).toHaveBeenCalledWith({ ...emptyValue, hand: 'left' });
  });

  it('calls onRemove when the trash button is clicked', () => {
    const onRemove = vi.fn();
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={() => {}} onRemove={onRemove} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /remove_pair/i }));
    expect(onRemove).toHaveBeenCalled();
  });

  it('disables all controls when disabled=true', () => {
    render(
      <PairRow index={0} entries={entries} value={emptyValue}
        onChange={() => {}} onRemove={() => {}} disabled />,
    );
    for (const sel of screen.getAllByRole('combobox')) {
      expect(sel).toBeDisabled();
    }
    expect(screen.getByRole('button', { name: /remove_pair/i })).toBeDisabled();
  });
});
