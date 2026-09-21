import type { Metadata, Viewport } from "next";

import { Shell } from "@/components/shell";
import { auth } from "@/lib/auth";

import "./globals.css";

export const metadata: Metadata = {
  title: "CDEXIO — Futures Agent",
  description: "Live monitoring for the CDEXIO Binance USDⓈ-M futures agent.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  // The shell is skipped for the two pages that exist to GET a session. A nav
  // bar on the sign-in screen offers links that redirect straight back to it.
  const authenticated = Boolean(session?.user?.email && session.pinVerified);

  return (
    <html lang="en">
      <body>
        <div className="aurora" aria-hidden />
        {authenticated ? <Shell email={session?.user?.email}>{children}</Shell> : children}
      </body>
    </html>
  );
}
