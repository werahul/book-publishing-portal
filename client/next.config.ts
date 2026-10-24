import type { NextConfig } from "next";

// Server-only: the Express API origin. Never exposed to the browser.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

if (!process.env.JWT_SECRET) {
  console.warn(
    "[config] JWT_SECRET is not set — the route guard (src/proxy.ts) will treat every visitor as logged out.",
  );
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  // The browser only ever talks to this origin; /api/* is proxied to Express.
  // That keeps the session cookie first-party (see docs/02-architecture.md §3.1).
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${API_URL}/api/:path*` }];
  },
};

export default nextConfig;
