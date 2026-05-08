import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';

/**
 * Static sitemap — lists every public, indexable route. Tournament-,
 * athlete-, and news-detail pages are not yet here because they require
 * a server fetch (ISR / dynamic sitemap territory). When the API exposes
 * a public-listing endpoint, switch this to fetch-and-merge.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const routes = [
    '',
    '/news',
    '/athletes',
    '/rankings',
    '/tournaments',
    '/sport/armwrestling',
    '/legal/terms',
    '/legal/privacy',
  ];
  return routes.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
