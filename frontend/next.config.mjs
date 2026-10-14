/** @type {import('next').NextConfig} */

// Backend origin the /api proxy forwards to (server-side only).
// Strip any trailing slash so `${BACKEND_URL}/api/...` never becomes `//api`.
const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/+$/, '');

const nextConfig = {
  reactStrictMode: true,
  // Same-origin API proxy: the browser calls /api/* on this app; Next forwards
  // to the backend. Keeps auth cookies first-party and avoids CORS.
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${BACKEND_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
