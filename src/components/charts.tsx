"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { money, utcDateTime } from "@/lib/format";

/**
 * Chart primitives, sharing one axis style and one tooltip.
 *
 * ONE Y-AXIS, EVER. Two measures of different scale get two charts or an
 * indexed common base — never a second axis. A dual-axis chart lets the author
 * choose where the lines cross, which means the reader is looking at a
 * decision rather than at the data.
 *
 * The grid and axes are recessive on purpose: they are scaffolding, and every
 * pixel of ink they take is ink the marks do not have.
 */

const AXIS = {
  stroke: "var(--color-ink-muted)",
  fontSize: 11,
  tickLine: false,
  axisLine: false,
} as const;

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass rounded-xl px-3 py-2 text-xs shadow-xl">
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Row({ label, value, colour }: { label: string; value: string; colour?: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-[var(--color-ink-muted)]">{label}</span>
      <span className="tabular font-medium" style={colour ? { color: colour } : undefined}>
        {value}
      </span>
    </div>
  );
}

/** Equity over closed trades. An area rather than a line: the fill says
 *  "a level that accumulates", which is what a balance is. */
export function EquityChart({
  data,
}: {
  data: { t: string; equity: number; pnl: number; symbol: string }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-series-1)" stopOpacity={0.42} />
            <stop offset="100%" stopColor="var(--color-series-1)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} />
        <XAxis
          dataKey="t"
          {...AXIS}
          tickFormatter={(v: string) => utcDateTime(v).split(" ").slice(0, 2).join(" ")}
          minTickGap={48}
        />
        <YAxis {...AXIS} domain={["auto", "auto"]} tickFormatter={(v: number) => `$${v.toFixed(0)}`} width={54} />
        <Tooltip
          cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as (typeof data)[number];
            return (
              <Frame>
                <Row label={point.symbol} value={utcDateTime(point.t)} />
                <Row label="Equity" value={money(point.equity)} />
                <Row
                  label="Trade"
                  value={money(point.pnl, { signed: true })}
                  colour={point.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"}
                />
              </Frame>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="equity"
          stroke="var(--color-series-1)"
          strokeWidth={2}
          fill="url(#equityFill)"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Net PnL per UTC day. Bars because each day is a discrete quantity, and
 *  coloured by sign because the sign IS the message. */
export function DailyPnlChart({
  data,
}: {
  data: { date: string; netPnl: number; trades: number; wins: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} />
        <XAxis dataKey="date" {...AXIS} tickFormatter={(v: string) => v.slice(5)} minTickGap={24} />
        <YAxis {...AXIS} tickFormatter={(v: number) => `$${v.toFixed(0)}`} width={54} />
        <Tooltip
          cursor={{ fill: "var(--color-surface-overlay)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as (typeof data)[number];
            return (
              <Frame>
                <Row label="Date" value={point.date} />
                <Row
                  label="Net PnL"
                  value={money(point.netPnl, { signed: true })}
                  colour={point.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"}
                />
                <Row label="Trades" value={`${point.wins}W / ${point.trades - point.wins}L`} />
              </Frame>
            );
          }}
        />
        <Bar dataKey="netPnl" radius={[4, 4, 0, 0]} maxBarSize={38}>
          {data.map((point) => (
            <Cell
              key={point.date}
              fill={point.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Net PnL per symbol, worst first. Horizontal because symbol names are words
 *  and words do not fit under a vertical bar without rotating them. */
export function SymbolChart({
  data,
}: {
  data: { symbol: string; netPnl: number; trades: number; winRate: number }[];
}) {
  const shown = data.slice(0, 12);
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, shown.length * 30)}>
      <BarChart data={shown} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" horizontal={false} />
        <XAxis type="number" {...AXIS} tickFormatter={(v: number) => `$${v.toFixed(0)}`} />
        <YAxis type="category" dataKey="symbol" {...AXIS} width={92} />
        <Tooltip
          cursor={{ fill: "var(--color-surface-overlay)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as (typeof data)[number];
            return (
              <Frame>
                <Row label="Symbol" value={point.symbol} />
                <Row
                  label="Net PnL"
                  value={money(point.netPnl, { signed: true })}
                  colour={point.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"}
                />
                <Row label="Win rate" value={`${(point.winRate * 100).toFixed(0)}%`} />
                <Row label="Trades" value={String(point.trades)} />
              </Frame>
            );
          }}
        />
        <Bar dataKey="netPnl" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {shown.map((point) => (
            <Cell
              key={point.symbol}
              fill={point.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
