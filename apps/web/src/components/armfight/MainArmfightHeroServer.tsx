import { fetchFeaturedArmfight } from '@/lib/api-server';
import { MainArmfightHero } from './MainArmfightHero';

/** Server component — SSR fetch for SEO on server-rendered pages. */
export async function MainArmfightHeroServer() {
  const tournament = await fetchFeaturedArmfight();
  return <MainArmfightHero tournament={tournament} />;
}
