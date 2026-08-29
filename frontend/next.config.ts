import type { NextConfig } from "next";

// Proxy the API through this origin so the browser talks to `/api/v1/*` on its
// own host. That keeps the auth flow same-origin, which lets the backend own an
// HttpOnly `ds_refresh` cookie (SameSite=Lax) that JS can never read.
// Set API_PROXY_TARGET in prod to the backend origin (no trailing slash).
const API_PROXY_TARGET = process.env.API_PROXY_TARGET ?? "http://localhost:3001";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_PROXY_TARGET}/api/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
