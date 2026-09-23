"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink, X } from "lucide-react";

import { CandleChart } from "@/components/candle-chart";
import { Badge } from "@/components/ui";
import type { AiStatus, Candle } from "@/lib/bot-api";
import { price as formatPrice } from "@/lib/format";

/** What the modal needs. Deliberately not `Position`, so a closed trade from
 *  the history page can open the same panel — the two share a symbol, a side,
 *  an entry and some levels, and duplicating the whole component for the
 *  differences would guarantee they drift. */
export type DetailTarget = {
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  exitPrice?: number | null;
  markPrice?: number | null;
  stopPrice?: number | null;
  takeProfitPrice?: number | null;
  strategy?: string | null;
  score?: number | null;
  maxHoldHours?: number | null;
  holdRemainingHours?: number | null;
  leverage?: number | null;
  openedAt?: string | null;
  closedAt?: string | null;
  unrealizedPnl?: number | null;
  realizedPnl?: number | null;
  notional?: number | null;
  quantity?: number | null;
  marginUsd?: number | null;
  /** Return on margin, as a fraction — the exchange's own ROI. */
  roi?: number | null;
  /** The price move alone, leverage stripped out, as a fraction. */
  priceChange?: number | null;
  liquidationPrice?: number | null;
  liquidationDistance?: number | null;
  protected?: boolean | null;
  ageMinutes?: number | null;
  /** Closed trades: what the result was made of. */
  grossPnl?: number | null;
  fees?: number | null;
  funding?: number | null;
  durationMinutes?: number | null;
};

const WIB = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** `09:36 UTC · 16:36 WIB` — the bot's clock and the owner's, side by side. */
function when(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "—";
  const utc = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
  return `${utc} UTC · ${WIB.format(d).replace(/\./g, ":")} WIB`;
}

function span(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function pct(v: number | null | undefined, signed = false): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  const s = (v * 100).toFixed(2);
  return `${signed && v > 0 ? "+" : ""}${s}%`;
}

function Cell({
  label,
  children,
  hint,
  tone,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  tone?: "profit" | "loss" | null;
}) {
  return (
    <div>
      <dt className="text-[var(--color-ink-muted)]">{label}</dt>
      <dd
        className="tabular mt-0.5 font-medium"
        style={{
          color:
            tone === "profit"
              ? "var(--color-profit)"
              : tone === "loss"
                ? "var(--color-loss)"
                : undefined,
        }}
      >
        {children}
      </dd>
      {hint && <p className="text-[var(--color-ink-muted)] mt-0.5 text-[10px]">{hint}</p>}
    </div>
  );
}

function toneOf(v: number | null | undefined): "profit" | "loss" | null {
  if (v === null || v === undefined || !Number.isFinite(v) || v === 0) return null;
  return v > 0 ? "profit" : "loss";
}

function money(v: number | null | undefined, digits = 2): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v < 0 ? "−" : ""}$${Math.abs(v).toFixed(digits)}`;
}

function hours(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return `${v.toFixed(1)}h`;
}

/** A price at the precision it is quoted to. Printed raw, a float carried its
 *  binary noise onto the screen — "0.045259999999999995" for an entry of
 *  0.04526 — which reads as a precision the exchange would reject. */
function px(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return formatPrice(v);
}

/**
 * The verdict that describes THIS trade, not merely the newest one on the pair.
 *
 * THE HISTORY PAGE IS WHY THIS IS NOT A `find`. The endpoint returns the last
 * forty verdicts across every symbol, and a pair the engine has judged three
 * times has three rows. For an open position the newest is right, because the
 * position is the newest thing that happened. For a round trip that closed on
 * Tuesday, the newest row may be about an idea from this morning — attaching
 * it to Tuesday's trade would put words in the validator's mouth about a trade
 * it never saw.
 *
 * So when the open time is known, the answer is the last verdict at or BEFORE
 * it. `bar_ts` is the bar the candidate was born on and the position opened on
 * the bar after, so a verdict for this trade is always in the past; one in the
 * future belongs to a later idea. `decisions` arrives newest-first, so the
 * first match walking forward is the closest one.
 */
function pickVerdict(
  decisions: AiStatus["decisions"],
  symbol: string,
  side: "long" | "short",
  openedMs: number | null,
): AiStatus["decisions"][number] | null {
  // The ACTED verdict first: with two models answering every bar, the newest
  // row on a pair may be the comparison model's opinion, not the decision.
  const all = decisions.filter((d) => d.symbol === symbol && d.side === side);
  const mine = [...all.filter((d) => d.acted), ...all.filter((d) => !d.acted)];
  if (openedMs === null) return mine[0] ?? null;
  // A small allowance forward: the verdict is stamped with the bar, and the
  // fill lands seconds to minutes later on that same bar's close.
  const cutoff = openedMs + 60 * 60 * 1000;
  return mine.find((d) => Date.parse(d.at) <= cutoff) ?? null;
}

/**
 * Everything known about one trade, in one place.
 *
 * WHAT IT ANSWERS THAT THE ROW CANNOT: which route opened this, what the
 * engine scored it, what the validator said about it, how long it may run, and
 * where its levels sit against the actual price. Those live in four different
 * places — the exchange, `position_entries`, `ai_decisions` and the lake — and
 * a reader should not have to hold four pages open to put them together.
 *
 * The chart and the verdict are fetched when the modal OPENS, not with the
 * page. A candle series per position on a page listing five of them is five
 * lake reads nobody asked for.
 */
export function PositionDetail({
  target,
  onClose,
}: {
  target: DetailTarget | null;
  onClose: () => void;
}) {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [verdict, setVerdict] = useState<AiStatus["decisions"][number] | null>(null);
  const [loading, setLoading] = useState(false);
  // 30m first because it is the bar the engine decided on. The others are
  // offered because a level that looks arbitrary on the trading bar often sits
  // exactly on a 4h high, and that is not visible without changing frame.
  const [timeframe, setTimeframe] = useState<"15m" | "30m" | "1h" | "4h">("30m");
  // `document` exists only in the browser; the portal waits for it.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // KEYED ON THE SYMBOL AND SIDE, NEVER ON THE `target` OBJECT.
  //
  // The parent builds that object inline and re-renders every four seconds
  // from its own poll, so its identity changes on every tick. Depending on it
  // re-ran this effect four times a minute, and each run reset the chart to
  // "Reading the lake…" before the previous fetch could paint — a spinner that
  // never resolved, on data that was arriving perfectly well.
  const symbol = target?.symbol ?? null;
  const side = target?.side ?? null;
  const interval = timeframe;
  // A CLOSED TRADE ANCHORS THE CHART TO ITS OWN CLOSE, not to now. The history
  // page opens this panel for round trips that may be a week old; anchored to
  // now, the reader gets five days of price action that has nothing to do with
  // the row they clicked, with the trade itself off the right edge. Open
  // positions send nothing and keep following the live edge.
  const endMs = target?.closedAt ? Date.parse(target.closedAt) : null;
  const anchor = endMs && Number.isFinite(endMs) ? endMs : null;
  const parsedOpen = target?.openedAt ? Date.parse(target.openedAt) : NaN;
  const openedMs = Number.isFinite(parsedOpen) ? parsedOpen : null;

  useEffect(() => {
    if (!symbol || !side) return;
    let alive = true;
    setLoading(true);

    void (async () => {
      try {
        const [candleRes, aiRes] = await Promise.all([
          fetch(
            `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}` +
              // Half a window past the close, so the trade sits in the middle
              // of the chart rather than hard against its right edge.
              (anchor ? `&end=${anchor + 2 * 24 * 60 * 60 * 1000}` : ""),
            { cache: "no-store" },
          ),
          fetch("/api/ai", { cache: "no-store" }),
        ]);
        if (alive && candleRes.ok) {
          const body = (await candleRes.json()) as { candles: Candle[] };
          setCandles(body.candles ?? []);
        }
        if (alive && aiRes.ok) {
          const body = (await aiRes.json()) as AiStatus;
          setVerdict(pickVerdict(body.decisions, symbol, side, openedMs));
        }
      } catch {
        /* the panel renders without the chart rather than not at all */
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [symbol, side, interval, anchor, openedMs]);

  // Escape closes. A modal that can only be dismissed by hitting a small X is
  // a modal that traps somebody on a phone.
  useEffect(() => {
    if (!target) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [target, onClose]);

  const levels = target
    ? [
        {
          price: target.entryPrice,
          label: "entry",
          colour: "var(--color-ink-secondary)",
        },
        ...(target.stopPrice
          ? [
              {
                price: target.stopPrice,
                label: "stop",
                colour: "var(--color-loss)",
                dashed: true,
              },
            ]
          : []),
        ...(target.takeProfitPrice
          ? [
              {
                price: target.takeProfitPrice,
                label: "target",
                colour: "var(--color-profit)",
                dashed: true,
              },
            ]
          : []),
        ...(target.exitPrice
          ? [
              {
                price: target.exitPrice,
                label: "exit",
                colour: "var(--color-solana-bright)",
              },
            ]
          : []),
      ]
    : [];

  const pnl = target?.realizedPnl ?? target?.unrealizedPnl ?? null;

  // WHAT EACH LEVEL IS WORTH IN DOLLARS, from the entry, before fees. The
  // stop can sit on the winning side once it has trailed — then "at stop" is
  // profit already locked, and saying so is the point of showing it.
  const sign = target?.side === "short" ? -1 : 1;
  const qty = target?.quantity ?? null;
  const ref = target ? (target.exitPrice ?? target.markPrice ?? target.entryPrice) : null;
  const atStop =
    target?.stopPrice && qty ? sign * (target.stopPrice - target.entryPrice) * qty : null;
  const atTarget =
    target?.takeProfitPrice && qty
      ? sign * (target.takeProfitPrice - target.entryPrice) * qty
      : null;
  const stopDist = target?.stopPrice && ref ? Math.abs(ref - target.stopPrice) / ref : null;
  const targetDist =
    target?.takeProfitPrice && ref ? Math.abs(target.takeProfitPrice - ref) / ref : null;
  const risked = atStop !== null && atStop < 0 ? -atStop : null;
  const rewardRisk = risked && atTarget !== null && atTarget > 0 ? atTarget / risked : null;
  const rNow = risked && pnl !== null ? pnl / risked : null;
  const open = !target?.closedAt;

  // RENDERED INTO <body>, NOT WHERE IT IS DECLARED. `position: fixed` is only
  // fixed to the viewport while no ancestor has a transform, a filter or a
  // backdrop-filter — and every card here has two of them (`.glass` blurs its
  // backdrop, `Reveal` animates a transform). On the history page the panel
  // sits inside the table's card, so it was positioned against that card and
  // clipped by its `overflow-hidden`: it opened half off the bottom of the
  // screen behind a blur that covered only the table.
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {target && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            /* Wide on a desktop because the chart is the point, and 720px of
               SVG squeezed into 640 makes every candle a hairline; still one
               column and full width on a phone. */
            className="border-[var(--color-border)] max-h-[92vh] w-full max-w-6xl overflow-y-auto rounded-2xl border bg-[var(--color-surface-raised)] p-4 shadow-2xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold tracking-tight">{target.symbol}</h2>
                  <Badge intent={target.side}>{target.side}</Badge>
                  {target.strategy ? (
                    <Badge intent="neutral">{target.strategy}</Badge>
                  ) : (
                    <span className="text-[var(--color-ink-muted)] text-[10px]">route unknown</span>
                  )}
                  {target.leverage ? (
                    <span className="text-[var(--color-ink-muted)] text-[11px]">
                      {target.leverage}x
                    </span>
                  ) : null}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <a
                    href={`https://www.tradingview.com/chart/?symbol=BINANCE%3A${target.symbol}.P`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
                  >
                    TradingView <ExternalLink className="h-3 w-3" />
                  </a>
                  <a
                    href={`https://www.binance.com/en/futures/${target.symbol}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
                  >
                    Binance <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 rounded-lg p-1.5 text-[var(--color-ink-muted)] transition-colors hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div
                role="tablist"
                aria-label="Chart timeframe"
                className="inline-flex rounded-lg bg-[var(--color-surface-overlay)] p-0.5"
              >
                {(["15m", "30m", "1h", "4h"] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    role="tab"
                    aria-selected={tf === timeframe}
                    onClick={() => setTimeframe(tf)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors ${
                      tf === timeframe
                        ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm"
                        : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink-secondary)]"
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>
              <span className="text-[var(--color-ink-muted)] text-[11px]">
                {timeframe === "30m"
                  ? "the bar the engine decided on"
                  : `${candles.length} bars · engine decides on 30m`}
              </span>
            </div>

            <div className="mb-5">
              {loading ? (
                <div
                  className="grid place-items-center rounded-xl border border-dashed border-[var(--color-border)] text-xs text-[var(--color-ink-muted)]"
                  style={{ height: 300 }}
                >
                  Reading the lake…
                </div>
              ) : (
                // Scrollable on a narrow screen rather than squeezed: a
                // candle chart compressed to phone width stops being a chart.
                // The wrapper scrolls; the SVG keeps a readable minimum.
                <div className="-mx-1 overflow-x-auto px-1">
                  <div className="min-w-[640px]">
                    <CandleChart candles={candles} levels={levels} height={300} />
                  </div>
                </div>
              )}
            </div>

            <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
              <div>
                <dt className="text-[var(--color-ink-muted)]">Entry</dt>
                <dd className="tabular mt-0.5 font-medium">{px(target.entryPrice)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-muted)]">
                  {target.exitPrice ? "Exit" : "Mark"}
                </dt>
                <dd className="tabular mt-0.5 font-medium">
                  {px(target.exitPrice ?? target.markPrice)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-muted)]">Engine score</dt>
                <dd className="mt-0.5 font-medium">
                  {target.score !== null && target.score !== undefined
                    ? target.score.toFixed(3)
                    : "not recorded"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-muted)]">
                  {target.closedAt ? "Result" : "Unrealised"}
                </dt>
                <dd
                  className="mt-0.5 font-medium"
                  style={{
                    color:
                      pnl === null
                        ? undefined
                        : pnl >= 0
                          ? "var(--color-profit)"
                          : "var(--color-loss)",
                  }}
                >
                  {money(pnl)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-muted)]">Max hold</dt>
                {/* A dash alone read as "no limit". A position with no limit
                    of its own still has one — the account's — and saying so is
                    the difference between a rule and an absence of one. */}
                <dd className="mt-0.5 font-medium">
                  {target.maxHoldHours ? hours(target.maxHoldHours) : "account limit"}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-muted)]">Time left</dt>
                <dd className="mt-0.5 font-medium">
                  {target.closedAt ? "closed" : hours(target.holdRemainingHours)}
                </dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-muted)]">Stop</dt>
                <dd className="tabular mt-0.5 font-medium">{px(target.stopPrice)}</dd>
              </div>
              <div>
                <dt className="text-[var(--color-ink-muted)]">Target</dt>
                <dd className="tabular mt-0.5 font-medium">{px(target.takeProfitPrice)}</dd>
              </div>
            </dl>

            {/* ---- size and time ---- */}
            <p className="mb-2 text-sm font-medium">Size &amp; time</p>
            <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
              <Cell label="Quantity">{qty !== null ? qty.toLocaleString() : "—"}</Cell>
              <Cell label="Notional" hint="position size at entry">
                {money(target.notional)}
              </Cell>
              <Cell label="Margin" hint={target.leverage ? `at ${target.leverage}x` : undefined}>
                {money(target.marginUsd)}
              </Cell>
              <Cell
                label={open ? "ROI on margin" : "ROI on notional"}
                tone={toneOf(target.roi)}
                hint={
                  target.priceChange !== null && target.priceChange !== undefined
                    ? `price moved ${pct(target.priceChange, true)}`
                    : undefined
                }
              >
                {pct(target.roi, true)}
              </Cell>
              <Cell label="Opened">{when(target.openedAt)}</Cell>
              {open ? (
                <Cell label="Open for">{span(target.ageMinutes)}</Cell>
              ) : (
                <>
                  <Cell label="Closed">{when(target.closedAt)}</Cell>
                  <Cell label="Held">{span(target.durationMinutes)}</Cell>
                </>
              )}
            </dl>

            {/* ---- what the levels are worth ---- */}
            {(atStop !== null || atTarget !== null || target.liquidationPrice) && (
              <>
                <p className="mb-2 text-sm font-medium">Risk &amp; reward</p>
                <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
                  <Cell
                    label={atStop !== null && atStop >= 0 ? "Locked at stop" : "Loss at stop"}
                    tone={toneOf(atStop)}
                    hint={stopDist !== null ? `${pct(stopDist)} from ${open ? "mark" : "exit"}` : undefined}
                  >
                    {money(atStop)}
                  </Cell>
                  <Cell
                    label="Gain at target"
                    tone={toneOf(atTarget)}
                    hint={
                      targetDist !== null ? `${pct(targetDist)} from ${open ? "mark" : "exit"}` : undefined
                    }
                  >
                    {money(atTarget)}
                  </Cell>
                  <Cell label="Reward : risk" hint="target gain ÷ stop loss, before fees">
                    {rewardRisk !== null ? `${rewardRisk.toFixed(2)} : 1` : "—"}
                  </Cell>
                  <Cell
                    label={open ? "R now" : "R result"}
                    tone={toneOf(rNow)}
                    hint="result in units of what the stop risks"
                  >
                    {rNow !== null ? `${rNow >= 0 ? "+" : ""}${rNow.toFixed(2)}R` : "—"}
                  </Cell>
                  {open && (
                    <>
                      <Cell
                        label="Liquidation"
                        hint={
                          target.liquidationDistance !== null &&
                          target.liquidationDistance !== undefined
                            ? `${pct(target.liquidationDistance)} away`
                            : "cross margin: account-level"
                        }
                      >
                        {px(target.liquidationPrice)}
                      </Cell>
                      <Cell
                        label="Protected"
                        tone={target.protected === false ? "loss" : null}
                        hint="a stop is resting on the exchange"
                      >
                        {target.protected === null || target.protected === undefined
                          ? "—"
                          : target.protected
                            ? "yes"
                            : "NO STOP"}
                      </Cell>
                    </>
                  )}
                </dl>
              </>
            )}

            {/* ---- what a closed result was made of ---- */}
            {!open && (target.grossPnl !== undefined || target.fees !== undefined) && (
              <>
                <p className="mb-2 text-sm font-medium">Result breakdown</p>
                <dl className="mb-5 grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
                  <Cell label="Gross" tone={toneOf(target.grossPnl)}>
                    {money(target.grossPnl)}
                  </Cell>
                  <Cell label="Fees" tone={target.fees ? "loss" : null}>
                    {money(target.fees ? -Math.abs(target.fees) : target.fees)}
                  </Cell>
                  <Cell label="Funding" tone={toneOf(target.funding)}>
                    {money(target.funding)}
                  </Cell>
                  <Cell label="Net" tone={toneOf(target.realizedPnl)}>
                    {money(target.realizedPnl)}
                  </Cell>
                </dl>
              </>
            )}

            <div className="border-[var(--color-border)] border-t pt-4">
              <p className="mb-2 text-sm font-medium">What the AI said</p>
              {verdict ? (
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge
                      intent={
                        verdict.verdict === "buy"
                          ? "good"
                          : verdict.verdict === "watch"
                            ? "warn"
                            : "neutral"
                      }
                    >
                      {verdict.verdict}
                    </Badge>
                    <span className="rounded bg-[var(--color-surface-overlay)] px-1.5 py-0.5 text-[10px] font-semibold uppercase">
                      {verdict.model === "claude" ? "Claude" : "DeepSeek"}
                    </span>
                    <span className="text-[var(--color-ink-muted)] text-[10px]">
                      {when(verdict.at)}
                      {verdict.score !== null ? ` · scored ${verdict.score.toFixed(3)}` : ""}
                    </span>
                    {!verdict.acted && (
                      <span className="text-[var(--color-ink-muted)] text-[10px]">
                        not acted on — this model was only compared, not deciding
                      </span>
                    )}
                  </div>
                  <p className="text-[var(--color-ink-secondary)] mt-2 text-xs leading-relaxed">
                    {verdict.reason || "No reason given."}
                  </p>
                  {/* THE VALIDATOR'S LEVELS, WHICH ARE NOT THE POSITION'S.
                      Nothing in execution reads them — the stop and target
                      above are what is actually resting on the exchange, set
                      from ATR and the ROI floor. These are the model's own
                      answer to the same question, and putting them side by
                      side is the only way to see when the two disagree. */}
                  {(verdict.entry !== null ||
                    verdict.takeProfit !== null ||
                    verdict.stopLoss !== null) && (
                    <div className="mt-3 rounded-lg bg-[var(--color-surface-overlay)] px-3 py-2">
                      <p className="text-[var(--color-ink-muted)] text-[10px]">
                        Where the model would have put them — an opinion, not what is resting on the
                        exchange
                      </p>
                      <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                        {verdict.entry !== null && (
                          <span className="text-[var(--color-ink-secondary)]">
                            {verdict.verdict === "watch" ? "wanted" : "entry"}{" "}
                            <span className="tabular text-[var(--color-ink)]">
                              {px(verdict.entry)}
                            </span>
                          </span>
                        )}
                        {verdict.takeProfit !== null && (
                          <span className="text-[var(--color-ink-secondary)]">
                            TP{" "}
                            <span className="tabular text-[var(--color-profit)]">
                              {px(verdict.takeProfit)}
                            </span>
                          </span>
                        )}
                        {verdict.stopLoss !== null && (
                          <span className="text-[var(--color-ink-secondary)]">
                            SL{" "}
                            <span className="tabular text-[var(--color-loss)]">
                              {px(verdict.stopLoss)}
                            </span>
                          </span>
                        )}
                        {verdict.maxHoldHours !== null && (
                          <span className="text-[var(--color-ink-secondary)]">
                            hold{" "}
                            <span className="tabular text-[var(--color-ink)]">
                              {hours(verdict.maxHoldHours)}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[var(--color-ink-muted)] text-xs leading-relaxed">
                  The validator never saw this one. It reviews a limited batch per cycle, so a
                  candidate the engine took can have no verdict at all — which is different from
                  having been refused.
                </p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
