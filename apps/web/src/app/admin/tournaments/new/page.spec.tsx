import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}));

const apiPatch = vi.fn();
vi.mock('@/lib/api', () => ({ api: { patch: (...args: unknown[]) => apiPatch(...args) } }));

const mutateAsyncMock = vi.fn();
vi.mock('@/hooks/useAdmin', () => ({
  useCreateTournament: () => ({
    mutateAsync: (...args: unknown[]) => mutateAsyncMock(...args),
    isPending: false,
  }),
}));

// `useSports` is re-exported from this module by `_lib/hooks.ts`, so a single
// mock here serves both call sites in the wizard.
vi.mock('@/hooks/useAthletes', () => ({
  useSports: () => ({
    data: [
      {
        id: 'sport-arm',
        slug: 'armwrestling',
        nameRu: 'Армрестлинг',
        nameEn: 'Armwrestling',
        nameHy: '',
      },
      {
        id: 'sport-box',
        slug: 'boxing',
        nameRu: 'Бокс',
        nameEn: 'Boxing',
        nameHy: '',
      },
    ],
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

import NewTournamentPage from './page';

beforeEach(() => {
  pushMock.mockReset();
  apiPatch.mockReset();
  mutateAsyncMock.mockReset();
});

/**
 * The wizard is a 372-line orchestration component over four step sub-components.
 * These specs cover the orchestration contract (renders Step 1, gates the Save
 * Draft button on the same predicate as `canAdvance`, opens the sport picker on
 * click). Step-level field rules are covered by the existing
 * `_lib/hooks.spec.ts` and `_lib/types.spec.ts`.
 */
describe('NewTournamentPage', () => {
  it('renders Step 1 by default with the tournament name + venue fields visible', () => {
    renderWithProviders(<NewTournamentPage />);

    expect(screen.getByPlaceholderText('name_placeholder')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('venue_placeholder')).toBeInTheDocument();
  });

  it('marks the footer Next button as aria-disabled when required Step 1 fields are empty', () => {
    renderWithProviders(<NewTournamentPage />);

    // The footer renders both desktop (`footer_next_with_step`) and mobile
    // (`footer_next`) spans inside one button, so a partial-name match picks
    // it up regardless of which span contributes to the accessible name in
    // jsdom (which ignores `hidden sm:inline` Tailwind utilities).
    const nextButton = screen.getByRole('button', { name: /footer_next/i });
    expect(nextButton).toHaveAttribute('aria-disabled', 'true');
  });

  it('opens the sport dropdown on click and lists every mocked sport', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewTournamentPage />);

    // The trigger shows the `sport_placeholder` key when nothing is selected.
    await user.click(screen.getByText('sport_placeholder'));

    // Both sport names should now be in the open menu.
    expect(screen.getByText('Армрестлинг')).toBeInTheDocument();
    expect(screen.getByText('Бокс')).toBeInTheDocument();
  });

  it('disables Save Draft until name + sport + startDate + venue are all filled', async () => {
    const user = userEvent.setup();
    renderWithProviders(<NewTournamentPage />);

    const saveDraft = screen.getByRole('button', { name: 'save_draft' });
    expect(saveDraft).toBeDisabled();

    await user.type(screen.getByPlaceholderText('name_placeholder'), 'Spring Cup 2026');
    await user.type(screen.getByPlaceholderText('venue_placeholder'), 'Yerevan Arena');

    const dateInputs = document.querySelectorAll<HTMLInputElement>(
      'input[type="datetime-local"]',
    );
    expect(dateInputs.length).toBeGreaterThan(0);
    await user.type(dateInputs[0], '2027-06-01T10:00');

    // Open the sport dropdown and pick boxing.
    await user.click(screen.getByText('sport_placeholder'));
    await user.click(screen.getByText('Бокс'));

    await waitFor(() => expect(saveDraft).not.toBeDisabled());
  });
});
