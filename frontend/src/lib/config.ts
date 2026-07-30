/**
 * API base URLs.
 *
 * - Client components use a RELATIVE base ('') so requests go to the Next.js
 *   app's own origin and are proxied to the backend via next.config rewrites.
 *   This keeps auth cookies first-party (works in all browsers) and removes CORS.
 * - Server Components / route handlers run on the server and must use an
 *   ABSOLUTE URL straight to the backend.
 */
export const API_URL = ''; // client → same-origin, proxied

export const SERVER_API_URL =
  process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Public base URL of this site (used for sitemap/robots/canonical). */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
