import type { MetadataRoute } from 'next';

/**
 * Production requires `NEXT_PUBLIC_SITE_URL`; falling through to
 * localhost in production would silently advertise the wrong sitemap
 * URL to crawlers.
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
 * Generate `/robots.txt` from app-router metadata. Public pages are
 * indexable; admin / operator panels are excluded so they don't surface
 * in search results even if accidentally linked. The `/api/` disallow
 * is defensive — the NestJS API lives on a different origin so Next.js
 * doesn't normally serve `/api/*`, but if a Route Handler is ever added
 * we want it kept out of search by default.
 *
 * Note: the `host` directive was dropped; it's a non-standard Yandex
 * extension that Google ignores. The `sitemap` URL is the canonical
 * way to point bots at the index.
 */
export default function robots(): MetadataRoute.Robots {
  const siteUrl = resolveSiteUrl();
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/operator', '/operator/', '/api/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
