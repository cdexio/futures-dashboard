"use client";

import { useEffect, useRef, useState } from "react";

import type { Candle } from "@/lib/bot-api";

/** Pixels per candle on a phone. Fitting 240 candles into 360px gave each one
 *  a pixel and a half; at this width the chart scrolls instead. */
const NARROW_SLOT_PX = 7;

type Level = { price: number; label: string; colour: string; dashed?: boolean };

/**
 * A candlestick chart drawn as inline SVG, with the trade's own levels on it.
 *
 * NO CHART LIBRARY. What this draws is 200 rectangles, four lines and some
 * text; a charting library would be 80KB on a phone to render that, and every
 * one of them wants to own the axis, the tooltip and the theme. Inline SVG
 * inherits the page's colour tokens for free and there is nothing to keep in
 * sync.
 *
 * ON A PHONE IT SCROLLS, and opens at the newest candle. The whole window
 * squeezed into the screen was unreadable; the right edge is where the reader
 * looks first, so that is where the scroll starts.
 *
 * The y-axis is scaled to include the LEVELS, not only the price. A take-profit
 * seven percent away is off the top of a chart scaled to the candles alone, and
 * the one thing the reader came to see — how far the target is — would be the
 * one thing missing.
 */
export function CandleChart({
  candles,
  levels = [],
  height = 280,
}: {
  candles: Candle[];
  levels?: Level[];
  height?: number;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 640px)");
    const apply = () => setNarrow(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  // Newest candle in view on every new series — a timeframe switch included.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [candles, narrow]);

  if (!candles.length) {
    return (
      <div
        className="border-[var(--color-border)] grid place-items-center rounded-xl border border-dashed text-xs text-[var(--color-ink-muted)]"
        style={{ height }}
      >
        No candles for this pair yet.
      </div>
    );
  }

  const padRight = 62; // room for the price axis
  const width = narrow ? Math.max(360, candles.length * NARROW_SLOT_PX + padRight) : 720;
  const padBottom = 18;
  const plotWidth = width - padRight;
  const plotHeight = height - padBottom;

  const highs = candles.map((c) => c.h);
  const lows = candles.map((c) => c.l);
  const prices = [...highs, ...lows, ...levels.map((l) => l.price)].filter(
    (p) => Number.isFinite(p) && p > 0,
  );
  const rawMax = Math.max(...prices);
  const rawMin = Math.min(...prices);
  // A flat series would divide by zero. Giving it 1% of its own value keeps
  // the candles visible as a line rather than collapsing them onto the axis.
  const span = rawMax - rawMin || rawMax * 0.01 || 1;
  const pad = span * 0.06;
  const max = rawMax + pad;
  const min = rawMin - pad;

  const y = (price: number) => plotHeight - ((price - min) / (max - min)) * plotHeight;
  const slot = plotWidth / candles.length;
  const body = Math.max(1.5, Math.min(slot * 0.62, 10));

  const digits = rawMax < 1 ? 6 : rawMax < 100 ? 4 : 2;
  const tick = (p: number) => p.toFixed(digits);

  // Four gridlines. More turns a 280px chart into graph paper; fewer stops the
  // reader being able to place a level by eye.
  const grid = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);

  return (
    <div ref={scroller} className="overflow-x-auto overscroll-x-contain">
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={narrow ? undefined : "w-full"}
      style={narrow ? { height, width } : { height }}
      role="img"
      aria-label="Price candles with the trade's levels"
    >
      {grid.map((price, i) => (
        <g key={`g${i}`}>
          <line
            x1={0}
            x2={plotWidth}
            y1={y(price)}
            y2={y(price)}
            stroke="var(--color-border)"
            strokeWidth={0.5}
          />
          <text
            x={plotWidth + 6}
            y={y(price) + 3}
            fontSize={9}
            fill="var(--color-ink-muted)"
            fontFamily="ui-monospace, monospace"
          >
            {tick(price)}
          </text>
        </g>
      ))}

      {candles.map((c, i) => {
        const x = i * slot + slot / 2;
        const up = c.c >= c.o;
        const colour = up ? "var(--color-profit)" : "var(--color-loss)";
        const top = y(Math.max(c.o, c.c));
        const bottom = y(Math.min(c.o, c.c));
        return (
          <g key={c.t}>
            <line x1={x} x2={x} y1={y(c.h)} y2={y(c.l)} stroke={colour} strokeWidth={0.8} />
            <rect
              x={x - body / 2}
              y={top}
              width={body}
              // A doji has zero body and would vanish; 1px keeps it on the page.
              height={Math.max(1, bottom - top)}
              fill={colour}
              opacity={up ? 0.9 : 0.85}
            />
          </g>
        );
      })}

      {levels
        .filter((l) => Number.isFinite(l.price) && l.price > 0)
        .map((level) => (
          <g key={level.label}>
            <line
              x1={0}
              x2={plotWidth}
              y1={y(level.price)}
              y2={y(level.price)}
              stroke={level.colour}
              strokeWidth={1}
              strokeDasharray={level.dashed ? "4 3" : undefined}
              opacity={0.85}
            />
            <text
              x={4}
              y={y(level.price) - 4}
              fontSize={9}
              fill={level.colour}
              fontFamily="ui-monospace, monospace"
            >
              {level.label} {tick(level.price)}
            </text>
          </g>
        ))}
    </svg>
    </div>
  );
}
