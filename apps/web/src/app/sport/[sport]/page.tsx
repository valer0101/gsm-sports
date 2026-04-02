import { SportHero } from './_SportHero';

export default async function SportOverviewPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  return <SportHero sportSlug={sport} />;
}
