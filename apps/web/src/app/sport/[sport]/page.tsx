import { SportHero } from './_SportHero';
import { UpcomingBattles } from './_UpcomingBattles';
import { MainArmfightHeroServer } from '@/components/armfight/MainArmfightHeroServer';
import { UpcomingArmfights } from '@/components/armfight/UpcomingArmfights';

export default async function SportOverviewPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  return (
    <>
      <SportHero sportSlug={sport} />
      {sport === 'armwrestling' && (
        <>
          <MainArmfightHeroServer />
          <UpcomingArmfights />
        </>
      )}
      <UpcomingBattles sportSlug={sport} />
    </>
  );
}
