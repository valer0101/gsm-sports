import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/link', () => ({
  default: ({ children, href }: any) => <a href={href}>{children}</a>,
}));

import { EmptyEntriesState } from './EmptyEntriesState';

describe('EmptyEntriesState', () => {
  it('renders the empty-state copy and a back link to the tournament', () => {
    render(<EmptyEntriesState tournamentId="t1" />);
    expect(screen.getByText('empty_no_entries_title')).toBeInTheDocument();
    expect(screen.getByText('empty_no_entries_body')).toBeInTheDocument();
    const link = screen.getByRole('link', { name: 'back_to_tournament' });
    expect(link).toHaveAttribute('href', '/admin/tournaments/t1');
  });
});
