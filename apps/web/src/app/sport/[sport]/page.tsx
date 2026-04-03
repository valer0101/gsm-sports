import { SportHero } from './_SportHero';
import { UpcomingBattles } from './_UpcomingBattles';

export default async function SportOverviewPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  return (
    <>
      <SportHero sportSlug={sport} />
      <UpcomingBattles sportSlug={sport} />
    </>
  );
}
