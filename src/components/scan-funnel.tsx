"use client";

import { useEffect, useState } from "react";
import { Radar } from "lucide-react";

import { Badge } from "@/components/ui";
import type { ScanHistoryRow, ScanSummary } from "@/lib/bot-api";
import { relative, utcTime } from "@/lib/format";

type ScanState = { last: ScanSummary | null; history: ScanHistoryRow[] };

/** One stage of the funnel: a label, how many survived it, and a bar scaled
 *  to the universe so the drop between stages is visible without reading. */
function Stage({
  label,
  value,
  of,
  note,
  tone = "neutral",
}: {
  label: string;
  value: number | undefined;
  of: number;
  note?: string;
  tone?: "neutral" | "good";
}) {
  const share = of > 0 && value !== undefined ? Math.max(value / of, value > 0 ? 0.02 : 0) : 0;
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs">
      <span className="text-[var(--color-ink-secondary)] truncate">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
        <div
          className={`h-full rounded-full ${
            tone === "good" ? "bg-[var(--color-profit)]" : "bg-[var(--color-solana)]"
          }`}
          style={{ width: `${share * 100}%` }}
        />
      </div>
      <span className="tabular w-16 text-right font-medium">
        {value ?? "—"}
        {note && <span className="text-[var(--color-ink-muted)] ml-1 text-[10px]">{note}</span>}
      </span>
    </div>
  );
}

/** A list of reasons with counts, worst first — the "why" behind a stage. */
function Reasons({ rows, empty }: { rows: { reason: string; count: number }[]; empty: string }) {
  if (!rows.length) {
    return <p className="text-[var(--color-ink-muted)] text-[11px]">{empty}</p>;
  }
  const top = Math.max(...rows.map((r) => r.count));
  return (
    <ul className="space-y-1.5">
      {rows.map((row) => (
        <li key={row.reason} className="flex items-center gap-2 text-[11px]">
          <span className="tabular w-8 shrink-0 text-right font-medium">{row.count}</span>
          <div className="relative min-w-0 flex-1">
            <div
              className="absolute inset-y-0 left-0 rounded bg-[var(--color-surface-overlay)]"
              style={{ width: `${(row.count / top) * 100}%` }}
            />
            <span className="text-[var(--color-ink-secondary)] relative block truncate px-1.5 py-0.5">
              {row.reason}
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * What the last scan did with every symbol, stage by stage.
 *
 * THE QUESTION IT ANSWERS, in the owner's words: "300 pairs scanned — how many
 * failed the engine, and why?" The log said "3 signals on the newest bar" and
 * nothing about the other 297, which is exactly the difference between a
 * quiet market and a broken filter. The trader now writes a structured
 * summary every cycle; this renders it without re-parsing any sentence.
 *
 * Three "why" lists, one per place a candidate can die: inside the engine
 * (no strategy fired, wrong regime, too high in its range), at the score
 * gate, and at the runner (cooldown, leverage cap, position limit, exchange
 * refusal). Each is sorted worst first, because the question is always which
 * rule is doing the refusing.
 */
export function ScanFunnel() {
  const [state, setState] = useState<ScanState | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch("/api/scan", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as ScanState;
        if (alive) {
          setState(body);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };
    void tick();
    // A scan lands every thirty minutes; polling faster only redraws it.
    const timer = setInterval(tick, 30000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const last = state?.last ?? null;
  const universe = last?.universe ?? 0;
  const engineDrops = (last?.engine ?? []).filter((r) => r.reason !== "signal");
  const signalled = (last?.engine ?? []).find((r) => r.reason === "signal")?.count;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Radar className="h-4 w-4 text-[var(--color-solana-bright)]" />
          <h2 className="text-lg font-semibold tracking-tight">Last scan</h2>
        </div>
        {failed ? (
          <span className="text-xs text-[var(--color-loss)]">Unreachable</span>
        ) : last ? (
          <span className="text-[var(--color-ink-muted)] text-xs">
            {utcTime(last.at)} UTC · {relative(last.at)} · every 30 min
          </span>
        ) : null}
      </div>

      {!last ? (
        <p className="text-[var(--color-ink-muted)] py-6 text-center text-xs">
          No scan yet.
        </p>
      ) : last.skipped ? (
        <p className="rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/[0.06] px-3 py-2 text-xs text-[var(--color-warning)]">
          Scan skipped — {last.skipped}
        </p>
      ) : (
        <div className="space-y-5">
          {last.universeChosenAt && (
            <p className="text-[var(--color-ink-muted)] -mt-2 text-[11px]">
              {universe} pairs by turnover · picked {relative(last.universeChosenAt)} · refresh every{" "}
              {last.universeRefreshHours ?? 8}h
            </p>
          )}
          <div className="space-y-2">
            <Stage label="Pairs in the universe" value={universe} of={universe} />
            <Stage
              label="With data this bar"
              value={last.withData}
              of={universe}
              note={last.missingData ? `−${last.missingData}` : undefined}
            />
            <Stage label="Passed the engine" value={signalled ?? last.newestBar} of={universe} />
            <Stage
              label="Passed the score gate"
              value={last.scoreGate?.kept ?? last.newestBar}
              of={universe}
            />
            {last.ai && (
              <Stage
                label={last.ai.shadow ? "AI would buy (shadow)" : "AI approved"}
                value={last.ai.buy}
                of={universe}
                note={`of ${last.ai.reviewed}`}
              />
            )}
            <Stage label="Positions opened" value={last.opened?.length ?? 0} of={universe} tone="good" />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium">No-signal reasons</p>
            <Reasons rows={engineDrops} empty="None" />
          </div>

          {!!last.candidates?.length && (
            <div>
              <p className="mb-2 flex items-baseline justify-between text-xs font-medium">
                <span>Candidates on this bar</span>
                <span className="text-[var(--color-ink-muted)] text-[10px] font-normal">
                  {last.candidates.length} · by score
                </span>
              </p>
              {/* A table with its own scroll, not a wall of chips: a busy bar
                  carried 116 candidates and pushed the rest of the page a
                  screen and a half down. */}
              <div className="max-h-72 overflow-auto rounded-lg border border-[var(--color-border)]">
                <table className="w-full min-w-[360px] text-[11px]">
                  <thead className="sticky top-0 bg-[var(--color-surface-raised)]">
                    <tr className="text-[var(--color-ink-muted)] text-left">
                      <th className="px-3 py-1.5 font-medium">#</th>
                      <th className="px-3 py-1.5 font-medium">Symbol</th>
                      <th className="px-3 py-1.5 font-medium">Side</th>
                      <th className="px-3 py-1.5 font-medium">Route</th>
                      <th className="px-3 py-1.5 text-right font-medium">Score</th>
                      <th className="px-3 py-1.5 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...last.candidates]
                      .sort((a, b) => (b.score ?? -1) - (a.score ?? -1))
                      .map((c, i) => (
                        <tr
                          key={`${c.symbol}-${c.side}`}
                          className="border-t border-[var(--color-border)]/60"
                        >
                          <td className="text-[var(--color-ink-muted)] tabular px-3 py-1">{i + 1}</td>
                          <td className="px-3 py-1 font-semibold">{c.symbol}</td>
                          <td className="px-3 py-1">
                            <Badge intent={c.side === "long" ? "long" : "short"}>{c.side}</Badge>
                          </td>
                          <td className="text-[var(--color-ink-secondary)] px-3 py-1">
                            {c.strategy}
                          </td>
                          <td className="tabular px-3 py-1 text-right">
                            {c.score !== null ? c.score.toFixed(3) : "—"}
                          </td>
                          <td className="px-3 py-1">
                            {last.opened?.includes(c.symbol) ? (
                              <Badge intent="good">opened</Badge>
                            ) : (
                              <span className="text-[var(--color-ink-muted)]">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {last.scoreGate?.summary && (
            <p className="text-[var(--color-ink-muted)] text-[11px]">
              Score gate: {last.scoreGate.summary}
            </p>
          )}

          <div>
            <p className="mb-2 text-xs font-medium">Refused by runner</p>
            <Reasons rows={last.refused ?? []} empty={last.newestBar ? "None" : "No candidates"} />
          </div>

          {!!state?.history.length && (
            <div>
              <p className="mb-2 text-xs font-medium">Recent cycles</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] text-[11px]">
                  <thead>
                    <tr className="text-[var(--color-ink-muted)] text-left">
                      <th className="py-1 pr-3 font-medium">UTC</th>
                      <th className="py-1 pr-3 text-right font-medium">Signals</th>
                      <th className="py-1 pr-3 text-right font-medium">To runner</th>
                      <th className="py-1 text-right font-medium">Opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.history.slice(0, 12).map((row) => (
                      <tr key={row.at} className="border-t border-[var(--color-border)]/50">
                        <td className="tabular py-1 pr-3">{utcTime(row.at)}</td>
                        {row.skipped ? (
                          <td colSpan={3} className="text-[var(--color-ink-muted)] py-1 text-right">
                            skipped
                          </td>
                        ) : (
                          <>
                            <td className="tabular py-1 pr-3 text-right">{row.newestBar ?? "—"}</td>
                            <td className="tabular py-1 pr-3 text-right">{row.toRunner ?? "—"}</td>
                            <td className="tabular py-1 text-right">{row.opened}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
