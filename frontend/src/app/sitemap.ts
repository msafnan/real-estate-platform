import type { MetadataRoute } from 'next';
import { SERVER_API_URL, SITE_URL } from '../lib/config';
import { Paginated, PropertyCard } from '../lib/types';

// Generated per-request so it always reflects current listings (the DB is the
// source of truth). In production you may prefer `revalidate = 3600` with the
// backend reachable at build time, to serve a cached sitemap.
export const dynamic = 'force-dynamic';

/**
 * Sitemap of static routes + recent property detail pages.
 *
 * NOTE: with 50k+ listings a production sitemap would use a **sitemap index**
 * split into ≤50k-URL child sitemaps. Here we include the most recent ~500
 * listings (5 pages of the cursor-paginated list) which is plenty for the demo
 * and keeps the file small. If the backend is unreachable at build time we fall
 * back to the static routes only.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/properties`, changeFrequency: 'hourly', priority: 0.9 },
    { url: `${SITE_URL}/login`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/register`, changeFrequency: 'yearly', priority: 0.2 },
  ];

  const propertyRoutes: MetadataRoute.Sitemap = [];
  try {
    let cursor: string | null = null;
    for (let page = 0; page < 5; page++) {
      const qs = new URLSearchParams({ limit: '100', ...(cursor ? { cursor } : {}) });
      const res = await fetch(`${SERVER_API_URL}/api/properties?${qs.toString()}`, {
        next: { revalidate: 3600 },
      });
      if (!res.ok) break;
      const data: Paginated<PropertyCard> = await res.json();
      for (const p of data.data) {
        propertyRoutes.push({
          url: `${SITE_URL}/properties/${p.id}`,
          lastModified: p.createdAt,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
      cursor = data.nextCursor;
      if (!cursor) break;
    }
  } catch {
    /* backend unreachable at build — static routes only */
  }

  return [...staticRoutes, ...propertyRoutes];
}
