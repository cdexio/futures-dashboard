import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Providers } from "@/components/providers";
import { Shell } from "@/components/shell";
import { STEP_PATH, getAccess } from "@/lib/access";

import "./globals.css";

export const metadata: Metadata = {
  title: "CDEXIO — Futures Agent",
  description: "Live monitoring for the CDEXIO Binance USDⓈ-M futures agent.",
  robots: { index: false, follow: false },
  applicationName: "CDEXIO",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  // iOS ignores most of the manifest and reads these instead: without
  // `capable`, "Add to Home Screen" opens Safari with its address bar.
  appleWebApp: { capable: true, title: "CDEXIO", statusBarStyle: "black" },
};

export const viewport: Viewport = {
  themeColor: "#0b0b0f",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const access = await getAccess();
  const pathname = (await headers()).get("x-pathname") ?? "/";

  // ONE GATE FOR EVERY PAGE. Each request is sent to the first step it is
  // missing, and a finished one is sent away from the steps. The pages behind
  // it never render half-authorised and throw on their first data read.
  const target = access.step === "ok" ? null : STEP_PATH[access.step];
  const onStep = Object.values(STEP_PATH).includes(pathname);
  if (target && pathname !== target) redirect(target);
  if (!target && onStep) redirect("/");

  return (
    <html lang="en">
      <body>
        <div className="aurora" aria-hidden />
        <Providers>
          {/* The shell is skipped on the steps. A nav bar on the sign-in
              screen offers links that redirect straight back to it. */}
          {access.step === "ok" ? <Shell email={access.email}>{children}</Shell> : children}
        </Providers>
      </body>
    </html>
  );
}
