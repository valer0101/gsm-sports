import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next-intl', () => ({ useTranslations: () => (k: string) => k }));
vi.mock('next/link', () => ({ default: ({ children }: any) => <a>{children}</a> }));
vi.mock('next/image', () => ({ default: (p: any) => <img alt={p.alt} /> }));

import { MainArmfightHero } from './MainArmfightHero';
import type { Tournament } from '@/types/api';

const t = (o: Partial<Tournament> = {}): Tournament => ({
  id: '1', slug: 's', name: 'ARMFIGHT NIGHT', nameRu: null, nameEn: null, nameHy: null,
  descriptionRu: null, descriptionEn: null, descriptionHy: null,
  startDate: new Date(Date.now() + 86400_000).toISOString(), endDate: null,
  location: null, country: null, city: 'Yerevan', format: 'armfight',
  maxParticipants: null, registrationOpen: false, registrationDeadline: null,
  bracketGenerated: false, status: 'upcoming', isFeatured: true, isLive: false,
  posterUrl: null, streamUrl: null, armfightVideoUrl: null, sport: null,
  weightCategories: [], sportConfig: null, ...o,
});

describe('MainArmfightHero', () => {
  it('renders nothing when tournament is null', () => {
    const { container } = render(<MainArmfightHero tournament={null} />);
    expect(container.firstChild).toBeNull();
  });
  it('renders nothing when the event is completed', () => {
    const { container } = render(<MainArmfightHero tournament={t({ status: 'completed' })} />);
    expect(container.firstChild).toBeNull();
  });
  it('shows the title and countdown when upcoming', () => {
    render(<MainArmfightHero tournament={t()} />);
    expect(screen.getByText('ARMFIGHT NIGHT')).toBeInTheDocument();
    expect(screen.getByTestId('cd-root')).toBeInTheDocument();
  });
  it('omits the weight/title badge when none is set', () => {
    render(<MainArmfightHero tournament={t({ sportConfig: null })} />);
    expect(screen.queryByTestId('af-badge')).toBeNull();
  });
  it('shows the weight/title badge when set', () => {
    render(<MainArmfightHero tournament={t({ sportConfig: { weightTitle: '+105 КГ' } })} />);
    expect(screen.getByTestId('af-badge')).toHaveTextContent('+105 КГ');
  });
  it('omits the city line when city is null', () => {
    render(<MainArmfightHero tournament={t({ city: null })} />);
    expect(screen.queryByTestId('af-city')).toBeNull();
  });
});
