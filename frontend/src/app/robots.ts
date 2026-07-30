import type { MetadataRoute } from 'next';
import { SITE_URL } from '../lib/config';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // Auth + owner-only areas add no SEO value.
      disallow: ['/dashboard', '/login', '/register', '/properties/new'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
