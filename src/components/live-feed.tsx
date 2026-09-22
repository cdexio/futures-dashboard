"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AlertTriangle, CircleAlert, Info, Sparkles } from "lucide-react";

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

type Source = "engine" | "ai";

const TABS: { id: Source; label: string; hint: string }[] = [
  {
    id: "engine",
    label: "Engine",
    hint: "The bot's own rules — what it scanned, opened, protected and closed.",
  },
  {
    id: "ai",
    label: "AI",
    hint: "The second opinion, and what it cost. Its answers change nothing while it is watching only.",
  },
];

/**
 * What the bot is doing, as it does it — split by who is doing it.
 *
 * TWO TABS RATHER THAN ONE LIST, AND THE REASON IS ARITHMETIC. The position
 * manager speaks every fifteen seconds; the validator speaks a few times an
 * hour. Merged into one feed of sixty rows, the AI's lines are pushed off the
 * end within a minute and the tab that was added to show them shows nothing.
 * The split happens on the SERVER, so each tab gets its own sixty rows.
 *
 * POLLED, NOT STREAMED. A websocket would be fewer bytes and one more moving
 * part that can silently stop — and a feed that has silently stopped looks
 * exactly like a bot that has nothing to say. A poll that fails is visible in
 * the timestamp on the newest row.
 *
 * Each tab keeps its own rows, so switching back does not blank the list while
 * a fetch is in flight. New rows animate in from the top and old ones do not
 * move: a list that re-animates wholesale on every poll is unreadable, and
 * this one refreshes every few seconds.
 */
export function LiveFeed({
  initial,
  initialAi = [],
}: {
  initial: ActivityEvent[];
  initialAi?: ActivityEvent[];
}) {
  const [tab, setTab] = useState<Source>("engine");
  const [feeds, setFeeds] = useState<Record<Source, ActivityEvent[]>>({
    engine: initial,
    ai: initialAi,
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch(`/api/activity?source=${tab}`, { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { events: ActivityEvent[] };
        if (alive) {
          setFeeds((current) => ({ ...current, [tab]: body.events }));
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };
    // Fetch at once on a tab change rather than waiting out the interval —
    // otherwise the first five seconds of the AI tab show the rows it had
    // when the page loaded, which on a quiet hour is nothing at all.
    void tick();
    const timer = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [tab]);

  const events = feeds[tab];
  const active = TABS.find((t) => t.id === tab)!;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold tracking-tight">Live</h2>
        {failed ? (
          <span className="text-xs text-[var(--color-loss)]">Feed unreachable</span>
        ) : (
          <LiveDot label="Streaming" />
        )}
      </div>

      <div
        role="tablist"
        aria-label="Live streaming source"
        className="mb-3 inline-flex rounded-lg bg-[var(--color-surface-overlay)] p-0.5"
      >
        {TABS.map((item) => {
          const selected = item.id === tab;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setTab(item.id)}
              className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                selected
                  ? "text-[var(--color-ink)]"
                  : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink-secondary)]"
              }`}
            >
              {selected && (
                <motion.span
                  layoutId="live-tab"
                  className="absolute inset-0 rounded-md bg-[var(--color-surface)] shadow-sm"
                  transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                {item.id === "ai" && <Sparkles className="h-3 w-3" />}
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Said on every tab, not once in a tooltip. A reader glancing at the AI
          rows has to be able to tell an opinion from an instruction. */}
      <p className="text-[var(--color-ink-muted)] mb-3 text-[11px] leading-relaxed">
        {active.hint}
      </p>

      <div className="max-h-[480px] space-y-1.5 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {events.slice(0, 60).map((event, index) => {
            const Icon = event.kind === "ai" ? Sparkles : ICON[event.level];
            return (
              <motion.div
                key={`${tab}-${event.at}-${index}-${event.message.slice(0, 24)}`}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="flex gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-surface-overlay)]"
              >
                <Icon
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${
                    event.kind === "ai"
                      ? "text-[var(--color-solana-bright)]"
                      : COLOUR[event.level]
                  }`}
                />
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
            {tab === "ai"
              ? "The validator has not spoken yet. It reviews candidates once a cycle, and only when there are candidates to review."
              : "No activity recorded yet."}
          </p>
        )}
      </div>
    </div>
  );
}
