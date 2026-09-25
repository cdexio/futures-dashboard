"use client";

import { useEffect, useState } from "react";
import { Gauge } from "lucide-react";

type Weight = {
  used: number;
  last: { used: number; at: number; service: string; path: string } | null;
  peakHour: number;
  limit: number;
  warnAt: number;
};

/**
 * How much of Binance's per-IP request allowance this minute has used.
 *
 * Added after 2026-09-25, when the allowance ran out and Binance banned the IP
 * for fifteen minutes: the bot could not see its own positions and this page
 * went blank. The number was always in every response header; this shows it
 * before a ban rather than after one. Engines past 1,600 also log a warning.
 */
export function WeightMeter() {
  const [w, setW] = useState<Weight | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/weight", { cache: "no-store" });
        const body = (await res.json()) as Weight;
        if (!alive) return;
        if (!res.ok) throw new Error();
        setW(body);
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
    };
    void tick();
    const timer = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  // Binance's own reading is the authority when it is this minute's.
  const now = Date.now() / 1000;
  const fresh = w?.last && Math.floor(w.last.at / 60) === Math.floor(now / 60);
  const used = Math.max(w?.used ?? 0, fresh ? (w?.last?.used ?? 0) : 0);
  const limit = w?.limit ?? 2400;
  const warnAt = w?.warnAt ?? 1600;
  const share = Math.min(used / limit, 1);
  const colour =
    used >= warnAt
      ? "var(--color-loss)"
      : used >= warnAt * 0.6
        ? "var(--color-warning)"
        : "var(--color-profit)";

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4 text-[var(--color-solana-bright)]" />
          <h2 className="text-lg font-semibold tracking-tight">Binance weight</h2>
        </div>
        {failed ? (
          <span className="text-xs text-[var(--color-loss)]">Unreachable</span>
        ) : (
          <span className="text-[var(--color-ink-muted)] text-xs">per IP · resets every minute</span>
        )}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="tabular text-2xl font-semibold" style={{ color: colour }}>
          {used.toLocaleString("en-US")}
        </span>
        <span className="text-[var(--color-ink-muted)] text-sm">
          / {limit.toLocaleString("en-US")} this minute
        </span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${share * 100}%`, background: colour }}
        />
      </div>
      <div className="mt-2 flex flex-wrap justify-between gap-2 text-[11px] text-[var(--color-ink-muted)]">
        <span>
          Peak last hour: {(w?.peakHour ?? 0).toLocaleString("en-US")} · warning at{" "}
          {warnAt.toLocaleString("en-US")}
        </span>
        {w?.last ? (
          <span>
            last read by {w.last.service} on {w.last.path || "—"}
          </span>
        ) : null}
      </div>
    </div>
  );
}
