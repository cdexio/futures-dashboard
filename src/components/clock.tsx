"use client";

import { useEffect, useState } from "react";
import { Clock as ClockIcon } from "lucide-react";

const UTC_FORMAT = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

const WIB_FORMAT = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "short",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

/** `Rab 23 Sep · 15:30:45` — built from parts, because id-ID separates the
 *  time with dots and a string replace would also hit any dotted month. */
function wib(now: Date): string {
  const part = Object.fromEntries(
    WIB_FORMAT.formatToParts(now).map((p) => [p.type, p.value] as const),
  );
  return `${part.weekday} ${part.day} ${part.month} · ${part.hour}:${part.minute}:${part.second}`;
}

/**
 * UTC beside WIB, ticking every second.
 *
 * Everything the bot writes — bars, logs, the daily loss reset — is UTC, and
 * the owner reads it in Jakarta, seven hours ahead. Showing both side by side
 * turns "the 08:30 bar" into a time on the owner's own clock without mental
 * arithmetic.
 *
 * Rendered only after mount: the server's second is not the browser's, and a
 * time printed on the server would mismatch on hydration.
 */
export function Clock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="glass flex items-center gap-3 rounded-xl border px-3 py-1.5 text-[11px] sm:text-xs"
      aria-label="Current time"
    >
      <ClockIcon className="text-[var(--color-ink-muted)] hidden h-3.5 w-3.5 sm:block" />
      <span className="tabular">
        <span className="text-[var(--color-ink-muted)] mr-1">UTC</span>
        <span className="font-medium">{now ? UTC_FORMAT.format(now) : "--:--:--"}</span>
      </span>
      <span className="bg-[var(--color-border-strong)] h-3.5 w-px" />
      <span className="tabular">
        <span className="text-[var(--color-ink-muted)] mr-1">WIB</span>
        <span className="font-medium text-[var(--color-solana-bright)]">
          {now ? wib(now) : "--:--:--"}
        </span>
      </span>
    </div>
  );
}
