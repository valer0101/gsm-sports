import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/link', () => ({ default: ({ children }: any) => <a>{children}</a> }));

import { MainArmfightMiniCard } from './MainArmfightMiniCard';
import type { Tournament } from '@/types/api';

const base = (o: Partial<Tournament> = {}): Tournament =>
  ({
    id: '1', slug: 's', name: 'AF', startDate: new Date(Date.now() + 86400_000).toISOString(),
    status: 'upcoming', armfightVideoUrl: null, city: null, posterUrl: null,
    sportConfig: null, format: 'armfight', ...o,
  } as unknown as Tournament);

describe('MainArmfightMiniCard', () => {
  it('returns null without a tournament', () => {
    const { container } = render(<MainArmfightMiniCard tournament={null} />);
    expect(container.firstChild).toBeNull();
  });
  it('shows the video button only when finished AND a video url exists', () => {
    render(
      <MainArmfightMiniCard
        tournament={base({ status: 'completed', armfightVideoUrl: 'https://youtu.be/x' })}
      />,
    );
    expect(screen.getByTestId('af-video')).toBeInTheDocument();
  });
  it('no video button when finished but no url', () => {
    render(<MainArmfightMiniCard tournament={base({ status: 'completed' })} />);
    expect(screen.queryByTestId('af-video')).toBeNull();
  });
});
