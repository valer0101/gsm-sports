'use client';
import { useFeaturedArmfight } from '@/hooks/useTournaments';
import { MainArmfightHero } from './MainArmfightHero';

/** Client component — for pages already rendered client-side (home). */
export function MainArmfightHeroClient() {
  const { data } = useFeaturedArmfight();
  return <MainArmfightHero tournament={data ?? null} />;
}
