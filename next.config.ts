import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The bot API is read through server-side route handlers, never fetched from
  // the browser. A rewrite would expose the account's whole position and
  // balance history to anyone who opened devtools and copied the URL — the
  // authentication lives in this app, and a path that bypasses it is a path
  // that eventually gets used.
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default config;
