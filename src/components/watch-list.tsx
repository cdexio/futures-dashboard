"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Eye } from "lucide-react";

import { Badge, EmptyState } from "@/components/ui";
import type { WatchEntry } from "@/lib/bot-api";

/** Seconds to something a person reads without doing arithmetic. */
function countdown(seconds: number): string {
  if (seconds <= 0) return "expiring";
  if (seconds < 3600) return `${Math.round(seconds / 60)}m left`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes ? `${hours}h ${minutes}m left` : `${hours}h left`;
}

/**
 * Coins the bot is keeping warm — good ideas that ran out of slots.
 *
 * WHAT THIS IS NOT. It is not a shortlist of what the bot is about to buy, and
 * it is not a recommendation. A candidate is here because it passed every
 * filter and then lost a queue position to five better-placed ones. When a
 * position closes, these are reconsidered FIRST, because the work of finding
 * and scoring them has already been paid for.
 *
 * NO PRICES ARE SHOWN, and the omission is deliberate rather than an
 * oversight. A watched candidate is re-scored and re-priced against the newest
 * candle before anything happens to it; showing the level it had when it was
 * shelved would invite acting on a stale number, which is the exact failure
 * the bot's own ten-minute entry window exists to prevent.
 *
 * The countdown is the useful column. What matters about a queue is what is
 * about to fall off it.
 */
export function WatchList({ initial }: { initial: WatchEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch("/api/watch", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { watching: WatchEntry[] };
        if (alive) {
          setEntries(body.watching);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };
    // Slower than the position poll on purpose. This list changes once a
    // cycle at most, and polling it every four seconds would spend requests
    // to redraw the same rows.
    const timer = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-[var(--color-solana-bright)]" />
          <h2 className="text-lg font-semibold tracking-tight">Watching</h2>
        </div>
        {failed ? (
          <span className="text-xs text-[var(--color-loss)]">Unreachable</span>
        ) : (
          <span className="text-[var(--color-ink-muted)] text-xs">
            {entries.length} queued
          </span>
        )}
      </div>

      <p className="text-[var(--color-ink-muted)] mb-4 text-[11px] leading-relaxed">
        A record, not a queue: the AI&apos;s WATCH verdicts (a level it would rather wait for)
        and approved buys the runner could not place, with why. Nothing is executed from
        here — each bar the engine scans again, and a pair that still signals is judged
        again on the new candle. Entries expire after 1–2 hours.
      </p>

      <div className="max-h-[320px] space-y-1.5 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {entries.map((entry) => (
            <motion.div
              key={`${entry.symbol}-${entry.side}`}
              layout
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-surface-overlay)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{entry.symbol}</span>
                  <Badge intent={entry.side}>{entry.side}</Badge>
                  <span className="text-[var(--color-ink-muted)] text-[10px]">
                    {entry.strategy}
                  </span>
                </div>
                <span className="text-[var(--color-ink-muted)] shrink-0 text-[10px]">
                  {countdown(entry.secondsLeft)}
                </span>
              </div>
              {entry.reason && (
                <p className="text-[var(--color-ink-secondary)] mt-1.5 text-[11px] leading-relaxed break-words">
                  {entry.reason}
                </p>
              )}
              {entry.score !== null && (
                <p className="text-[var(--color-ink-muted)] mt-1 text-[10px]">
                  scored {entry.score.toFixed(3)} when shelved
                </p>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {!entries.length && (
          <EmptyState
            title="Nothing queued"
            hint="Every idea that passed the filters got a slot, or none passed."
          />
        )}
      </div>
    </div>
  );
}
