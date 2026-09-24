"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { money } from "@/lib/format";

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
 *
 * NO ENTRY ANIMATION. Recharts draws each series in over 1.5 s by default,
 * which on a page opened to check a number reads as the page still loading.
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

/** One point of the cumulative series: realised PnL since the window opened,
 *  as dollars and as a share of the opening equity, and BTCUSDT's own move
 *  over the same span. `btc` is null where the lake has no candle for it. */
export type CumulativePoint = { t: number; pnl: number; pct: number; btc: number | null };

const day = (t: number) => new Date(t).toISOString().slice(5, 10);
const stamp = (t: number) => new Date(t).toISOString().slice(5, 16).replace("T", " ");
const signedPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

/** Series colours for the % chart, validated as a pair on the dark card
 *  surface (#13131a): CVD ΔE 32, normal-vision ΔE 32. Purple vs blue failed
 *  deuteranopia at ΔE 3.4. */
export const CUMULATIVE_COLOURS = { pnl: "var(--color-series-1)", btc: "var(--color-series-4)" };

// Props, not a wrapper component: recharts 2 finds its axes by element type,
// and an <XAxis> inside a component of our own is not found at all.
const TIME_AXIS = {
  dataKey: "t",
  type: "number" as const,
  scale: "time" as const,
  domain: ["dataMin", "dataMax"] as [string, string],
  ...AXIS,
  tickFormatter: day,
  minTickGap: 24,
};

/** Ticks on UTC midnights only, at most about eight of them. Recharts' own
 *  ticks on a time scale fall at arbitrary hours, and formatted as dates the
 *  same day was printed twice. */
function dayTicks(data: CumulativePoint[]): number[] {
  if (data.length < 2) return [];
  const dayMs = 24 * 60 * 60 * 1000;
  const first = Math.ceil(data[0].t / dayMs) * dayMs;
  const last = data[data.length - 1].t;
  const step = Math.max(1, Math.ceil((last - first) / dayMs / 8)) * dayMs;
  const ticks: number[] = [];
  for (let t = first; t <= last; t += step) ticks.push(t);
  return ticks;
}

/** Realised PnL since the window opened, in dollars. Starts at zero, like
 *  Binance's "PNL Kumulatif", rather than at the balance the equity curve
 *  starts from — the question is how much the bot made, not what the
 *  account holds. */
export function CumulativePnlChart({ data }: { data: CumulativePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <defs>
          <linearGradient id="cumulativeFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={CUMULATIVE_COLOURS.pnl} stopOpacity={0.32} />
            <stop offset="100%" stopColor={CUMULATIVE_COLOURS.pnl} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} />
        <XAxis {...TIME_AXIS} ticks={dayTicks(data)} />
        <YAxis {...AXIS} tickFormatter={(v: number) => `$${v.toFixed(0)}`} width={54} />
        <ReferenceLine y={0} stroke="var(--color-border-strong)" />
        <Tooltip
          cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as CumulativePoint;
            return (
              <Frame>
                <Row label="UTC" value={stamp(point.t)} />
                <Row
                  label="Cumulative PnL"
                  value={money(point.pnl, { signed: true })}
                  colour={point.pnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"}
                />
              </Frame>
            );
          }}
        />
        <Area
          type="linear"
          dataKey="pnl"
          stroke={CUMULATIVE_COLOURS.pnl}
          strokeWidth={2}
          fill="url(#cumulativeFill)"
          isAnimationActive={false}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

/** Cumulative PnL as a percentage of the opening equity, beside BTCUSDT's
 *  move over the same window. One axis: both are percentages of their own
 *  starting value, so they share a unit and a zero. */
export function CumulativePctChart({ data, showBtc }: { data: CumulativePoint[]; showBtc: boolean }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" vertical={false} />
        <XAxis {...TIME_AXIS} ticks={dayTicks(data)} />
        <YAxis {...AXIS} tickFormatter={(v: number) => `${v.toFixed(0)}%`} width={54} />
        <ReferenceLine y={0} stroke="var(--color-border-strong)" />
        <Tooltip
          cursor={{ stroke: "var(--color-border-strong)", strokeWidth: 1 }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as CumulativePoint;
            return (
              <Frame>
                <Row label="UTC" value={stamp(point.t)} />
                <Row label="PnL %" value={signedPct(point.pct)} colour={CUMULATIVE_COLOURS.pnl} />
                {showBtc && point.btc !== null && (
                  <Row label="BTCUSDT" value={signedPct(point.btc)} colour={CUMULATIVE_COLOURS.btc} />
                )}
              </Frame>
            );
          }}
        />
        {showBtc && (
          <Line
            type="linear"
            dataKey="btc"
            stroke={CUMULATIVE_COLOURS.btc}
            strokeWidth={2}
            isAnimationActive={false}
            dot={false}
            connectNulls
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        )}
        <Line
          type="linear"
          dataKey="pct"
          stroke={CUMULATIVE_COLOURS.pnl}
          strokeWidth={2}
          isAnimationActive={false}
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </LineChart>
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
        <Bar dataKey="netPnl" radius={[4, 4, 0, 0]} maxBarSize={38} isAnimationActive={false}>
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

/** One 3-hour UTC slot of the day, by when positions were OPENED. */
export type TimeSlot = { slot: string; netPnl: number; trades: number; wins: number };

/** Net PnL by the UTC hour a position was opened, in 3-hour slots, in clock
 *  order top to bottom — the order is the time of day, so it never sorts by
 *  value. Losses left, profits right, zero always in range. */
export function TimeOfDayChart({ data }: { data: TimeSlot[] }) {
  return (
    <ResponsiveContainer width="100%" height={data.length * 34 + 30}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, bottom: 4, left: 8 }}>
        <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 6" horizontal={false} />
        <XAxis
          type="number"
          {...AXIS}
          domain={[(min: number) => Math.min(0, min), (max: number) => Math.max(0, max)]}
          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
        />
        <YAxis type="category" dataKey="slot" {...AXIS} width={52} />
        <ReferenceLine x={0} stroke="var(--color-border-strong)" />
        <Tooltip
          cursor={{ fill: "var(--color-surface-overlay)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const point = payload[0].payload as TimeSlot;
            const end = String((Number(point.slot.slice(0, 2)) + 3) % 24).padStart(2, "0");
            return (
              <Frame>
                <Row label="Opened (UTC)" value={`${point.slot}–${end}:00`} />
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
        <Bar dataKey="netPnl" radius={4} maxBarSize={18} isAnimationActive={false}>
          {data.map((point) => (
            <Cell
              key={point.slot}
              fill={point.netPnl >= 0 ? "var(--color-profit)" : "var(--color-loss)"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
