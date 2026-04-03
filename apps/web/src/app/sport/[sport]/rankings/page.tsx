import { getLocale } from 'next-intl/server';
import { SportRankingsClient } from './_SportRankingsClient';

export default async function SportRankingsPage({ params }: { params: Promise<{ sport: string }> }) {
  const { sport } = await params;
  const locale = await getLocale();
  return <SportRankingsClient sport={sport} locale={locale} />;
}
