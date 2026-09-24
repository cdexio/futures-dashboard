"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { AlertTriangle, CircleAlert, Info, Sparkles } from "lucide-react";

import { AiVerdicts } from "@/components/ai-verdicts";
import { LiveDot } from "@/components/ui";
import type { ActivityEvent, AiStatus } from "@/lib/bot-api";
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
    hint: "Scans, entries, stops and exits",
  },
  {
    id: "ai",
    label: "AI",
    hint: "Verdicts and cost",
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
  initialAi = null,
}: {
  initial: ActivityEvent[];
  initialAi?: AiStatus | null;
}) {
  const [tab, setTab] = useState<Source>("engine");
  const [events, setEvents] = useState<ActivityEvent[]>(initial);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    // The ENGINE tab only. The AI tab renders structured rows from the
    // database rather than parsed log lines — the validator's decisions exist
    // as columns, so turning them back into sentences to re-parse them would
    // throw away the verdict, the score and the symbol.
    if (tab !== "engine") return;
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch("/api/activity?source=engine", { cache: "no-store" });
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
    void tick();
    const timer = setInterval(tick, 5000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [tab]);

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

      {tab === "ai" ? (
        <AiVerdicts initial={initialAi} />
      ) : (
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
                  {/* THE TOKEN, FIRST. The symbol was already in the data and
                      was never rendered, so "Trailing stop moved from 0.04583
                      to 0.04588" named no pair at all — a row that says
                      something happened and refuses to say to what. */}
                  {event.symbol && (
                    <span className="mr-2 text-xs font-semibold text-[var(--color-ink)]">
                      {event.symbol}
                    </span>
                  )}
                  <span className="text-[var(--color-ink-secondary)] text-xs leading-relaxed break-words">
                    {event.message}
                  </span>
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
      )}
    </div>
  );
}
