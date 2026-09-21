"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AlertTriangle, CircleAlert, Info } from "lucide-react";

import { LiveDot } from "@/components/ui";
import type { ActivityEvent } from "@/lib/bot-api";
import { relative } from "@/lib/format";

const ICON = {
  info: Info,
  warning: AlertTriangle,
  error: CircleAlert,
} as const;

const COLOUR = {
  info: "text-[var(--color-ink-muted)]",
  warning: "text-[var(--color-warning)]",
  error: "text-[var(--color-loss)]",
} as const;

/**
 * What the bot is doing, as it does it.
 *
 * POLLED, NOT STREAMED. A websocket would be fewer bytes and one more moving
 * part that can silently stop — and a feed that has silently stopped looks
 * exactly like a bot that has nothing to say. A poll that fails is visible in
 * the timestamp on the newest row.
 *
 * New rows animate IN from the top and old ones do not move. A list that
 * re-animates wholesale on every poll is unreadable, and this one refreshes
 * every few seconds.
 */
export function LiveFeed({ initial }: { initial: ActivityEvent[] }) {
  const [events, setEvents] = useState(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch("/api/activity", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { events: ActivityEvent[] };
        if (alive) {
          setEvents(body.events);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };
    const timer = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold tracking-tight">Live activity</h2>
        {failed ? (
          <span className="text-xs text-[var(--color-loss)]">Feed unreachable</span>
        ) : (
          <LiveDot label="Streaming" />
        )}
      </div>

      <div className="max-h-[520px] space-y-1.5 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {events.slice(0, 60).map((event, index) => {
            const Icon = ICON[event.level];
            return (
              <motion.div
                key={`${event.at}-${index}-${event.message.slice(0, 24)}`}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-surface-overlay)]"
              >
                <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${COLOUR[event.level]}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-[var(--color-ink-secondary)] text-xs leading-relaxed break-words">
                    {event.message}
                  </p>
                  <p className="text-[var(--color-ink-muted)] mt-1 text-[10px]">
                    {relative(event.at)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {!events.length && (
          <p className="text-[var(--color-ink-muted)] px-3 py-8 text-center text-xs">
            No activity recorded yet.
          </p>
        )}
      </div>
    </div>
  );
}
