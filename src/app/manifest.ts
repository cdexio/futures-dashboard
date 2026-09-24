import type { MetadataRoute } from "next";

/**
 * What a phone reads when the dashboard is added to its home screen.
 *
 * `standalone` is the point of it: no address bar, no browser tabs, its own
 * entry in the app switcher. It is also what the pull-to-refresh gesture keys
 * on — a standalone window has no browser reload button, so the page has to
 * provide one.
 *
 * Served WITHOUT a session. Browsers fetch the manifest without cookies, so a
 * protected manifest is a redirect to /login, and a redirect is not a manifest
 * — the install silently falls back to a bookmark with a screenshot for an
 * icon. The middleware matcher excludes it for that reason.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CDEXIO — Futures Agent",
    short_name: "CDEXIO",
    description: "Live monitoring for the CDEXIO Binance USDⓈ-M futures agent.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b0f",
    theme_color: "#0b0b0f",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
