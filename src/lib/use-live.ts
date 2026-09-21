"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Poll one endpoint and keep the latest answer, without ever showing nothing.
 *
 * SEEDED FROM THE SERVER RENDER. The first paint already has real data, so the
 * page never flashes a skeleton at a reader who came to check a balance. The
 * poll replaces that seed; it does not wait to produce it.
 *
 * WHY POLLING RATHER THAN A WEBSOCKET. A socket is fewer bytes and one more
 * thing that can stop without saying so — and a feed that has silently stopped
 * looks exactly like an account where nothing is happening. A failed poll is
 * visible: `stale` goes true and the page says so. On a page about money, a
 * reader knowing the number is old matters more than the number being new.
 *
 * NEVER OVERLAPPING. A request still in flight when the timer fires is not
 * joined by a second one. On a slow link that would queue requests faster than
 * they complete, and the page would end up displaying whichever raced home
 * last rather than whichever is newest.
 */
export function useLive<T>(url: string, seed: T, intervalMs = 4000) {
  const [data, setData] = useState<T>(seed);
  const [stale, setStale] = useState(false);
  const [at, setAt] = useState<number>(() => Date.now());
  const busy = useRef(false);

  useEffect(() => {
    let alive = true;

    const tick = async () => {
      if (busy.current) return;
      busy.current = true;
      try {
        const response = await fetch(url, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as T;
        if (alive) {
          setData(body);
          setStale(false);
          setAt(Date.now());
        }
      } catch {
        // The LAST GOOD DATA stays on screen, marked stale. Blanking it would
        // replace a number that was right a moment ago with nothing at all,
        // and "no data" is not more honest than "data from 20 seconds ago" —
        // it is less, because it hides that the number was ever known.
        if (alive) setStale(true);
      } finally {
        busy.current = false;
      }
    };

    // Paused while the tab is hidden. A dashboard left open overnight would
    // otherwise spend the exchange's rate limit on a screen nobody is looking
    // at — and the rate limit is shared with the bot that is placing orders.
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };

    const timer = setInterval(() => {
      if (document.visibilityState === "visible") void tick();
    }, intervalMs);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [url, intervalMs]);

  return { data, stale, at };
}
