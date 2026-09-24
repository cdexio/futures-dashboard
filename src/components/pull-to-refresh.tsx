"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDown, RefreshCw } from "lucide-react";

/** Distance the finger must travel, after resistance, before release refreshes. */
const THRESHOLD = 72;
const MAX_PULL = 120;
/** A refresh that completes in 80 ms still spins this long, so the gesture
 *  reads as "it did something" rather than a flicker. */
const MIN_SPIN_MS = 650;

/** Fired on window after a pull; `useLive` polls immediately on it. */
export const REFRESH_EVENT = "cdx:refresh";

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True when the touch began inside something that is itself scrolled down —
 *  a table, a drawer — where a downward drag means "scroll this back up". */
function insideScrolled(target: EventTarget | null) {
  for (let node = target as HTMLElement | null; node && node !== document.body; node = node.parentElement) {
    if (node.scrollTop > 0) return true;
  }
  return false;
}

/**
 * Pull down to refresh, for the home-screen app only.
 *
 * ONLY IN STANDALONE. A browser tab already has a reload button and, on
 * Android, its own pull-to-refresh; a second one fighting it is worse than
 * none. A home-screen app has neither, and without this the only way to
 * refresh is to close it from the app switcher.
 *
 * NOTHING HAPPENS UNTIL THE FINGER LIFTS. The pull only draws; release past
 * the threshold refreshes, release short of it springs back. A refresh that
 * fired mid-drag would re-render the page under a finger still moving on it.
 *
 * A SOFT REFRESH, NOT A RELOAD. `router.refresh()` re-renders the server
 * components with fresh data in place — no white flash, scroll kept, and the
 * shell never unmounts. The polled cards are told to fetch at the same time.
 */
export function PullToRefresh() {
  const router = useRouter();
  const [enabled, setEnabled] = useState(false);
  const [pull, setPull] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [pending, startTransition] = useTransition();
  const start = useRef<number | null>(null);
  const pullRef = useRef(0);
  const spinningRef = useRef(false);

  useEffect(() => {
    setEnabled(isStandalone());
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const onStart = (event: TouchEvent) => {
      if (spinningRef.current || event.touches.length !== 1) return;
      if (window.scrollY > 0 || insideScrolled(event.target)) return;
      start.current = event.touches[0].clientY;
    };

    const onMove = (event: TouchEvent) => {
      if (start.current === null) return;
      const delta = event.touches[0].clientY - start.current;
      if (delta <= 0 || window.scrollY > 0) {
        if (pullRef.current !== 0) {
          pullRef.current = 0;
          setPull(0);
        }
        return;
      }
      // Rubber-band: the further the drag, the less each pixel moves the
      // indicator, so it feels attached to the finger and then resists.
      const eased = MAX_PULL * (1 - Math.exp(-delta / (MAX_PULL * 1.6)));
      pullRef.current = eased;
      setDragging(true);
      setPull(eased);
      // Stop iOS's rubber-band scroll from moving the page along with it.
      if (event.cancelable) event.preventDefault();
    };

    const onEnd = () => {
      if (start.current === null) return;
      start.current = null;
      setDragging(false);
      if (pullRef.current >= THRESHOLD) {
        spinningRef.current = true;
        setSpinning(true);
        setPull(THRESHOLD * 0.75);
        const began = Date.now();
        window.dispatchEvent(new Event(REFRESH_EVENT));
        startTransition(() => router.refresh());
        // Settled by the effect below once the transition and the minimum
        // spin have both finished.
        setTimeout(() => {
          spinningRef.current = false;
          setSpinning(false);
        }, Math.max(0, MIN_SPIN_MS - (Date.now() - began)));
      } else {
        setPull(0);
      }
      pullRef.current = 0;
    };

    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onEnd, { passive: true });
    window.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, router]);

  const busy = spinning || pending;
  useEffect(() => {
    if (!busy && !dragging) setPull(0);
  }, [busy, dragging]);

  if (!enabled) return null;

  const progress = Math.min(1, pull / THRESHOLD);
  const armed = progress >= 1;

  return (
    <div
      aria-hidden={!busy}
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center"
      style={{
        transform: `translateY(${pull - 48}px)`,
        opacity: busy ? 1 : Math.min(1, progress * 1.4),
        transition: dragging ? "none" : "transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 240ms ease",
      }}
    >
      <div className="glass grid h-10 w-10 place-items-center rounded-full border border-[var(--color-border-strong)] shadow-lg">
        {busy ? (
          <RefreshCw className="h-4 w-4 animate-spin text-[var(--color-solana-bright)]" />
        ) : (
          <ArrowDown
            className="h-4 w-4 transition-transform duration-200"
            style={{
              transform: `rotate(${armed ? 180 : 0}deg)`,
              color: armed ? "var(--color-solana-bright)" : "var(--color-ink-secondary)",
            }}
          />
        )}
        {busy && <span className="sr-only">Refreshing</span>}
      </div>
    </div>
  );
}
