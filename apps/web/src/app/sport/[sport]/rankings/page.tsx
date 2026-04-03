import { SportRankingsClient } from './_SportRankingsClient';
import { fetchWorldRankings } from '@/lib/api-server';

export default async function SportRankingsPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;

  const [initialRight, initialLeft] = await Promise.all([
    fetchWorldRankings(sport, 'right'),
    fetchWorldRankings(sport, 'left'),
  ]);

  return (
    <SportRankingsClient
      sport={sport}
      initialRight={initialRight}
      initialLeft={initialLeft}
    />
  );
}
