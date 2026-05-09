import type { MetadataRoute } from 'next';

/**
 * In production we require `NEXT_PUBLIC_SITE_URL` so that absolute URLs
 * (canonical, OG, sitemap, robots) point at the real domain. Falling
 * through to `localhost:3001` in dev is fine; falling through in prod
 * silently breaks SEO and link previews.
 */
function resolveSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return fromEnv;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_SITE_URL must be set in production');
  }
  return 'http://localhost:3001';
}

/**
 * Static sitemap — lists every public, indexable route. Tournament-,
 * athlete-, and news-detail pages are not yet here because they require
 * a server fetch (ISR / dynamic sitemap territory). When the API exposes
 * a public-listing endpoint, switch this to fetch-and-merge.
 *
 * Legal pages (`/legal/terms`, `/legal/privacy`) are intentionally
 * excluded: their bodies are placeholders and the pages themselves are
 * `robots: { index: false }`. Re-add them here once finalized.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = resolveSiteUrl();
  const now = new Date();
  const routes = ['', '/news', '/athletes', '/rankings', '/tournaments'];
  return routes.map((path) => ({
    url: `${siteUrl}${path}`,
    lastModified: now,
    changeFrequency: path === '' ? 'daily' : 'weekly',
    priority: path === '' ? 1 : 0.7,
  }));
}
