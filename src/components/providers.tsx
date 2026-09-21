"use client";

import { SessionProvider } from "next-auth/react";

/**
 * Client-side session access, needed only so the PIN page can call `update()`
 * after a correct entry. Everything else reads the session on the server,
 * where it cannot be tampered with.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
