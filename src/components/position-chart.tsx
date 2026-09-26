"use client";

import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  HistogramSeries,
  createChart,
  type IChartApi,
  type IPrimitivePaneRenderer,
  type IPrimitivePaneView,
  type ISeriesApi,
  type ISeriesPrimitive,
  type SeriesAttachedParameter,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";

import type { Candle } from "@/lib/bot-api";

/**
 * The position drawn the way TradingView's Long/Short Position tool draws it:
 * a green zone from entry to target, a red one from entry to stop, each edge
 * labelled with its price, its distance and what it is worth in dollars.
 *
 * WHY NOT THE TRADINGVIEW WIDGET. The free embed is an iframe; nothing outside
 * it may draw on it, so the owner's request (2026-09-26) — "show me visually
 * how much and toward what" — cannot be met there. This is TradingView's own
 * open-source Lightweight Charts, fed from the lake (4h built from 1h, as the
 * engine sees it), which spends no Binance weight.
 */

type Props = {
  symbol: string;
  side: "long" | "short";
  entryPrice: number;
  stopPrice?: number | null;
  takeProfitPrice?: number | null;
  exitPrice?: number | null;
  quantity?: number | null;
  openedAt?: string | null;
  closedAt?: string | null;
  /** How long the position may live; the box is drawn that far forward. */
  maxHoldHours?: number | null;
  height?: number;
};

const UP = "#26a69a";
const DOWN = "#ef5350";
const TIMEFRAMES = ["1h", "4h", "1d"] as const;
type Timeframe = (typeof TIMEFRAMES)[number];
const BAR_MS: Record<Timeframe, number> = { "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000 };

type Box = {
  side: 1 | -1;
  entry: number;
  stop: number | null;
  target: number | null;
  exit: number | null;
  qty: number | null;
  /** Logical bar indexes the zone spans: the entry bar, and the exit bar or
   *  the end of the holding limit — which may lie in the future, where only
   *  a logical index (not a time) has a coordinate. */
  from: number | null;
  to: number | null;
};

/** Five significant digits, never in exponent form: 0.00010265, 0.03553. */
function fmt(price: number): string {
  if (!Number.isFinite(price) || price === 0) return "0";
  const decimals = Math.min(Math.max(2, 4 - Math.floor(Math.log10(Math.abs(price)))), 12);
  return price.toFixed(decimals).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

function pct(from: number, to: number): string {
  const v = ((to - from) / from) * 100;
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function usd(v: number): string {
  return `${v >= 0 ? "+" : "−"}$${Math.abs(v).toFixed(2)}`;
}

/** Draws the two zones and their labels behind the candles. */
class PositionBox implements ISeriesPrimitive<Time> {
  private chart: IChartApi | null = null;
  private series: ISeriesApi<"Candlestick"> | null = null;
  private request: (() => void) | null = null;

  constructor(private box: Box) {}

  attached(param: SeriesAttachedParameter<Time>) {
    this.chart = param.chart as IChartApi;
    this.series = param.series as ISeriesApi<"Candlestick">;
    this.request = param.requestUpdate;
  }

  detached() {
    this.chart = this.series = this.request = null;
  }

  update(box: Box) {
    this.box = box;
    this.request?.();
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [{ zOrder: () => "bottom", renderer: () => this.renderer() }];
  }

  private renderer(): IPrimitivePaneRenderer | null {
    const { chart, series, box } = this;
    if (!chart || !series) return null;
    const y = (p: number | null) => (p === null ? null : series.priceToCoordinate(p));
    const scale = chart.timeScale();
    const xAt = (i: number | null) => (i === null ? null : scale.logicalToCoordinate(i as never));

    return {
      draw: (target) =>
        target.useMediaCoordinateSpace(({ context: ctx, mediaSize }) => {
          const yEntry = y(box.entry);
          if (yEntry === null) return;
          const x1 = Math.max(xAt(box.from) ?? 0, 0);
          const x2 = Math.min(xAt(box.to) ?? mediaSize.width, mediaSize.width);
          const width = Math.max(x2 - x1, 40);

          const zone = (price: number | null, colour: string) => {
            const yy = y(price);
            if (yy === null) return;
            ctx.fillStyle = colour;
            ctx.fillRect(x1, Math.min(yEntry, yy), width, Math.abs(yy - yEntry));
          };
          zone(box.target, "rgba(38,166,154,0.18)");
          zone(box.stop, "rgba(239,83,80,0.18)");

          const line = (price: number | null, colour: string, dash: number[] = []) => {
            const yy = y(price);
            if (yy === null) return;
            ctx.strokeStyle = colour;
            ctx.lineWidth = 1;
            ctx.setLineDash(dash);
            ctx.beginPath();
            ctx.moveTo(x1, yy);
            ctx.lineTo(x1 + width, yy);
            ctx.stroke();
            ctx.setLineDash([]);
          };
          line(box.entry, "#b0b3b8");
          line(box.target, UP);
          line(box.stop, DOWN);
          line(box.exit, "#a78bfa", [4, 3]);

          const label = (price: number | null, text: string, colour: string, above: boolean) => {
            const yy = y(price);
            if (yy === null) return;
            ctx.font = "600 11px ui-sans-serif, system-ui, sans-serif";
            const w = ctx.measureText(text).width + 12;
            const h = 18;
            // Inside the box when it fits; otherwise pulled left so it never
            // runs under the price scale.
            const lx = Math.max(Math.min(x1 + 6, mediaSize.width - w - 4), 4);
            const ly = above ? yy - h - 3 : yy + 3;
            ctx.fillStyle = colour;
            ctx.beginPath();
            ctx.roundRect(lx, ly, w, h, 4);
            ctx.fill();
            ctx.fillStyle = "#ffffff";
            ctx.fillText(text, lx + 6, ly + 13);
          };

          // Which edge sits above the entry decides where each label goes,
          // so a short's target (below) and stop (above) read the same way.
          const worth = (p: number) => (box.qty ? box.side * (p - box.entry) * box.qty : null);
          if (box.target !== null) {
            const v = worth(box.target);
            label(
              box.target,
              `Target ${fmt(box.target)}  ${pct(box.entry, box.target)}${v !== null ? `  ${usd(v)}` : ""}`,
              UP,
              box.target > box.entry,
            );
          }
          if (box.stop !== null) {
            const v = worth(box.stop);
            label(
              box.stop,
              `Stop ${fmt(box.stop)}  ${pct(box.entry, box.stop)}${v !== null ? `  ${usd(v)}` : ""}`,
              DOWN,
              box.stop > box.entry,
            );
          }
          const rr =
            box.target !== null && box.stop !== null
              ? Math.abs(box.target - box.entry) / Math.abs(box.stop - box.entry)
              : null;
          label(
            box.entry,
            `${box.side > 0 ? "Long" : "Short"} ${fmt(box.entry)}${rr !== null ? `  R:R ${rr.toFixed(2)}` : ""}`,
            "#4b5563",
            box.target !== null ? box.target < box.entry : true,
          );
          if (box.exit !== null) {
            const v = worth(box.exit);
            label(
              box.exit,
              `Exit ${fmt(box.exit)}${v !== null ? `  ${usd(v)}` : ""}`,
              "#7c3aed",
              box.exit > box.entry,
            );
          }
        }),
    };
  }

  updateAllViews() {}
}

/** Index of the bar that contains `iso`, or null. */
function barOf(candles: Candle[], iso: string | null | undefined): number | null {
  if (!iso || candles.length === 0) return null;
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  let hit: number | null = null;
  candles.forEach((c, i) => {
    if (c.t <= ms) hit = i;
  });
  return hit;
}

export function PositionChart(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const [timeframe, setTimeframe] = useState<Timeframe>("4h");
  const [candles, setCandles] = useState<Candle[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { symbol, closedAt } = props;

  // Fetch. A closed trade anchors the window two days past its close, so the
  // trade sits inside the chart rather than off its left edge.
  useEffect(() => {
    let alive = true;
    setCandles(null);
    setFailed(false);
    const end = closedAt ? Date.parse(closedAt) : NaN;
    const url =
      `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${timeframe}` +
      (Number.isFinite(end) ? `&end=${end + 2 * 86_400_000}` : "");
    fetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((body: { candles: Candle[] }) => alive && setCandles(body.candles ?? []))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [symbol, timeframe, closedAt]);

  // Draw.
  useEffect(() => {
    const node = host.current;
    if (!node || !candles || candles.length === 0) return;
    const levels = [props.entryPrice, props.stopPrice, props.takeProfitPrice, props.exitPrice]
      .filter((v): v is number => typeof v === "number" && v > 0);
    const ref = props.entryPrice;
    const precision = Math.min(Math.max(2, Math.ceil(-Math.log10(ref)) + 3), 10);

    const chart = createChart(node, {
      autoSize: true,
      layout: { background: { color: "transparent" }, textColor: "#9aa0a6", fontSize: 11 },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, rightOffset: 8 },
      crosshair: { mode: 0 },
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: UP,
      downColor: DOWN,
      borderVisible: false,
      wickUpColor: UP,
      wickDownColor: DOWN,
      priceFormat: { type: "price", precision, minMove: 10 ** -precision },
      // Keep the target and the stop on screen however far they are.
      autoscaleInfoProvider: (original: () => { priceRange: { minValue: number; maxValue: number } } | null) => {
        const res = original();
        if (!res || levels.length === 0) return res;
        return {
          ...res,
          priceRange: {
            minValue: Math.min(res.priceRange.minValue, ...levels),
            maxValue: Math.max(res.priceRange.maxValue, ...levels),
          },
        };
      },
    });
    series.setData(
      candles.map((c) => ({
        time: Math.floor(c.t / 1000) as UTCTimestamp,
        open: c.o,
        high: c.h,
        low: c.l,
        close: c.c,
      })),
    );
    const volume = chart.addSeries(HistogramSeries, {
      priceScaleId: "vol",
      priceFormat: { type: "volume" },
      lastValueVisible: false,
      priceLineVisible: false,
    });
    chart.priceScale("vol").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(
      candles.map((c) => ({
        time: Math.floor(c.t / 1000) as UTCTimestamp,
        value: c.v,
        color: c.c >= c.o ? "rgba(38,166,154,0.35)" : "rgba(239,83,80,0.35)",
      })),
    );

    // Axis tags for the levels, so their prices read on the scale too.
    const tag = (price: number | null | undefined, color: string, title: string) => {
      if (typeof price === "number" && price > 0) {
        series.createPriceLine({ price, color, lineVisible: false, axisLabelVisible: true, title });
      }
    };
    tag(props.takeProfitPrice, UP, "TP");
    tag(props.stopPrice, DOWN, "SL");
    tag(props.entryPrice, "#6b7280", "Entry");
    tag(props.exitPrice, "#7c3aed", "Exit");

    // The box runs from the entry bar to the exit bar, or — while open — to
    // the end of the holding limit, projected into empty bars on the right
    // the way TradingView's position tool projects forward.
    const lastIndex = candles.length - 1;
    const from = barOf(candles, props.openedAt);
    const holdBars = Math.max(
      1,
      Math.round(((props.maxHoldHours || 48) * 3_600_000) / BAR_MS[timeframe]),
    );
    const to = props.closedAt
      ? (barOf(candles, props.closedAt) ?? lastIndex)
      : from !== null
        ? from + holdBars
        : null;
    series.attachPrimitive(
      new PositionBox({
        side: props.side === "long" ? 1 : -1,
        entry: props.entryPrice,
        stop: props.stopPrice ?? null,
        target: props.takeProfitPrice ?? null,
        exit: props.exitPrice ?? null,
        qty: props.quantity ?? null,
        from,
        to,
      }),
    );

    // Frame the trade: forty bars of context before entry, through the end of
    // the box (plus a margin), however far into the future that is.
    if (from !== null && to !== null) {
      const right = Math.max(to, lastIndex) + 3;
      chart.timeScale().applyOptions({ rightOffset: Math.max(right - lastIndex, 4) });
      chart.timeScale().setVisibleLogicalRange({ from: Math.max(from - 40, 0), to: right });
    } else {
      chart.timeScale().fitContent();
    }

    return () => chart.remove();
  }, [
    candles,
    timeframe,
    props.side,
    props.entryPrice,
    props.stopPrice,
    props.takeProfitPrice,
    props.exitPrice,
    props.quantity,
    props.openedAt,
    props.closedAt,
    props.maxHoldHours,
  ]);

  const height = props.height ?? 520;
  return (
    <div className="relative overflow-hidden rounded-xl border border-[var(--color-border)]">
      <div className="absolute top-2 left-2 z-10 inline-flex rounded-md bg-black/40 p-0.5 backdrop-blur-sm">
        {TIMEFRAMES.map((tf) => (
          <button
            key={tf}
            type="button"
            onClick={() => setTimeframe(tf)}
            className={`rounded px-2 py-0.5 text-[11px] font-medium transition-colors ${
              tf === timeframe
                ? "bg-white/15 text-[var(--color-ink)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink-secondary)]"
            }`}
          >
            {tf}
          </button>
        ))}
      </div>
      {candles === null && !failed ? (
        <div className="grid place-items-center text-xs text-[var(--color-ink-muted)]" style={{ height }}>
          Loading chart…
        </div>
      ) : failed || (candles && candles.length === 0) ? (
        <div className="grid place-items-center text-xs text-[var(--color-ink-muted)]" style={{ height }}>
          No candles for {symbol}
        </div>
      ) : (
        <div ref={host} style={{ height }} />
      )}
    </div>
  );
}
