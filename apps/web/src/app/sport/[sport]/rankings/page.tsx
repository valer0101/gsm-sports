import { getLocale } from 'next-intl/server';
import { SportRankingsClient } from './_SportRankingsClient';
import { fetchWorldRankings } from '@/lib/api-server';

export default async function SportRankingsPage({
  params,
}: {
  params: Promise<{ sport: string }>;
}) {
  const { sport } = await params;
  const locale = await getLocale();

  const [initialRight, initialLeft] = await Promise.all([
    fetchWorldRankings(sport, 'right'),
    fetchWorldRankings(sport, 'left'),
  ]);

  return (
    <SportRankingsClient
      sport={sport}
      locale={locale}
      initialRight={initialRight}
      initialLeft={initialLeft}
    />
  );
}
