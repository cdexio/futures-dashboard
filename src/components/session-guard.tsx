"use client";

import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";

const HEARTBEAT_MS = 60 * 1000;
// Mirrors src/lib/access.ts. The server is the authority; these only let the
// screen lock the moment a limit passes instead of at the next heartbeat.
const IDLE_LIMIT_MS = 60 * 60 * 1000;
const CLOSED_LIMIT_MS = 15 * 60 * 1000;

/**
 * Keeps the PIN lock alive while the dashboard is in use, and locks the
 * screen when it is not.
 *
 * "IN USE" MEANS TOUCHED — a tap, a key, a scroll. A dashboard sitting open
 * on a desk, polling prices, is not in use, and after an hour of that the
 * next person to pick it up enters the PIN.
 *
 * "CLOSED" MEANS NOT VISIBLE. No heartbeat is sent while the page is hidden,
 * which on a phone is also what backgrounding or closing the app does. Back
 * inside 15 minutes: carries on. Later: PIN.
 *
 * A LOCK IS A FULL NAVIGATION, not a router push. The root layout runs its
 * gate only on a full render, and a hard load also drops every number on
 * screen — a locked dashboard should not keep the balance painted behind it.
 */
export function SessionGuard() {
  const pathname = usePathname();
  const lastActive = useRef(Date.now());
  const hiddenAt = useRef<number | null>(null);
  const locked = useRef(false);

  const lock = useCallback((to = "/pin") => {
    if (locked.current) return;
    locked.current = true;
    window.location.replace(to);
  }, []);

  const beat = useCallback(async () => {
    if (locked.current || document.visibilityState !== "visible") return;
    if (Date.now() - lastActive.current > IDLE_LIMIT_MS) return lock();
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ active: lastActive.current }),
        cache: "no-store",
      });
      if (response.status === 401) {
        const body = (await response.json().catch(() => ({}))) as { redirect?: string };
        lock(body.redirect ?? "/pin");
      }
    } catch {
      // Offline is not a reason to lock; the server decides when it next
      // hears from us, and it will say so then.
    }
  }, [lock]);

  useEffect(() => {
    const touched = () => {
      lastActive.current = Date.now();
    };

    const visibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt.current = Date.now();
        return;
      }
      const away = hiddenAt.current ? Date.now() - hiddenAt.current : 0;
      hiddenAt.current = null;
      if (away > CLOSED_LIMIT_MS) return lock();
      void beat();
    };

    // bfcache: iOS restores a standalone app from a frozen snapshot without
    // firing visibilitychange, so this is the only sign it was ever away.
    const restored = (event: PageTransitionEvent) => {
      if (event.persisted) void beat();
    };

    const events = ["pointerdown", "keydown", "touchstart", "wheel", "scroll"] as const;
    for (const name of events) window.addEventListener(name, touched, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pageshow", restored);
    const timer = setInterval(beat, HEARTBEAT_MS);

    return () => {
      for (const name of events) window.removeEventListener(name, touched);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pageshow", restored);
      clearInterval(timer);
    };
  }, [beat, lock]);

  // Every navigation checks in, so a lock that went stale while the app was
  // away is caught on the first tap rather than a minute later.
  useEffect(() => {
    lastActive.current = Date.now();
    void beat();
  }, [pathname, beat]);

  return null;
}
