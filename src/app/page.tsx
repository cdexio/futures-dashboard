import { Suspense } from "react";

import {
  CUMULATIVE_COLOURS,
  CumulativePctChart,
  CumulativePnlChart,
  DailyPnlChart,
  SymbolChart,
  type CumulativePoint,
} from "@/components/charts";
import { RouteCards } from "@/components/route-cards";
import { SkeletonChart, SkeletonStatCells, SkeletonStats } from "@/components/skeleton";
import { Card, EmptyState, Gauge, LiveDot, Reveal, SectionTitle, Stat } from "@/components/ui";
import {
  botFetch,
  type Analytics,
  type AccountSnapshot,
  type Candle,
  type Limits,
  type RouteStats,
} from "@/lib/bot-api";
import { TONE_CLASS, duration, money, percent, tone } from "@/lib/format";
import { limitPeriod } from "@/lib/limits";

// The account moves while this page is open, so nothing here may be cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * SEVEN DAYS, not thirty.
 *
 * Measured against the live API on 2026-09-22: `analytics?days=7` answers in
 * 0.88 s and `analytics?days=30` in 7.4 s — and the 30-day call was the one
 * that returned 500 when Binance's per-IP allowance had been spent. Three of
 * the five pages defaulted to 30, so the expensive answer was what every
 * reader got before choosing anything.
 *
 * The longer windows are one click away and cached for fifteen minutes once
 * somebody asks for them. A default is what a reader pays for without
 * deciding to.
 */
const DEFAULT_DAYS = "7";

const RANGES = [
  { label: "7D", value: "7" },
  { label: "30D", value: "30" },
  { label: "90D", value: "90" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days = DEFAULT_DAYS } = await searchParams;

  // NOTHING IS AWAITED HERE. Every read starts now, in parallel, and each
  // block streams in behind its own Suspense boundary. Measured 2026-09-24:
  // `account` alone took 0.6–2.3 s (three exchange calls, uncached by design),
  // and awaiting it here kept the whole screen blank for that long — the
  // header, the range picker and every skeleton included.
  const accountPromise = botFetch<AccountSnapshot>("/api/account");
  const limitsPromise = botFetch<Limits>("/api/limits");
  const analyticsPromise = botFetch<Analytics>(`/api/analytics?days=${days}`);
  const routesPromise = botFetch<{ routes: RouteStats[] }>(`/api/routes?days=${days}`);
  // The benchmark line: optional, so it never holds the charts back. A read
  // slower than BTC_WAIT_MS or a failed one drops the line, not the chart.
  const btcPromise = Promise.race([
    botFetch<{ candles: Candle[] }>("/api/candles?symbol=BTCUSDT&interval=4h"),
    new Promise<{ candles: Candle[] }>((resolve) =>
      setTimeout(() => resolve({ candles: [] }), BTC_WAIT_MS),
    ),
  ]).catch(() => ({ candles: [] as Candle[] }));

  const ranges = RANGES;

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
              <LiveDot />
            </div>
            <p className="text-[var(--color-ink-secondary)] mt-2 text-sm">
              Binance USDⓈ-M ·{" "}
              <Suspense fallback="…">
                <ModeLabel promise={accountPromise} />
              </Suspense>{" "}
              · last {days} days
            </p>
          </div>
          <div className="glass flex gap-1 rounded-xl p-1">
            {ranges.map((range) => (
              <a
                key={range.value}
                href={`/?days=${range.value}`}
                className={
                  range.value === days
                    ? "rounded-lg bg-[var(--color-solana)]/18 px-3.5 py-1.5 text-xs font-semibold text-[var(--color-solana-bright)]"
                    : "text-[var(--color-ink-secondary)] rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors hover:text-[var(--color-ink)]"
                }
              >
                {range.label}
              </a>
            ))}
          </div>
        </div>
      </Reveal>

      {/* The hero row, split by WHERE ITS NUMBERS COME FROM rather than by
          what they mean: equity and unrealized from the account snapshot,
          net PnL and ROI from the window's fills. Neither waits for the
          other. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Suspense fallback={<SkeletonStatCells count={2} />}>
          <AccountStats promise={accountPromise} />
        </Suspense>
        <Suspense fallback={<SkeletonStatCells count={2} />}>
          <HeadlinePnl promise={analyticsPromise} />
        </Suspense>
      </div>

      {/* Today's allowance. Above the charts because it is the only thing on
          this page that decides whether the bot may act in the next hour. */}
      <Suspense fallback={<SkeletonStats />}>
        <Allowance promise={limitsPromise} />
      </Suspense>

      {/* Numbers first, charts last — the owner's order, 2026-09-24. Each
          block has its own Suspense boundary so none waits for another. */}
      <Suspense fallback={<SkeletonStats />}>
        <PerformanceStats promise={analyticsPromise} />
      </Suspense>

      <Suspense fallback={<SkeletonStats />}>
        <RouteSection promise={routesPromise} days={days} />
      </Suspense>

      <Suspense
        fallback={
          <>
            <SkeletonChart />
            <SkeletonChart />
          </>
        }
      >
        <CumulativeCharts promise={analyticsPromise} btc={btcPromise} />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid gap-4 lg:grid-cols-2">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        }
      >
        <BreakdownCharts promise={analyticsPromise} />
      </Suspense>
    </div>
  );
}

/** How long the page waits for the BTC benchmark before drawing without it.
 *  The cache warmer keeps it at well under a second; this bounds a cold one. */
const BTC_WAIT_MS = 2500;

async function ModeLabel({ promise }: { promise: Promise<AccountSnapshot> }) {
  const account = await promise.catch(() => null);
  return <>{account ? account.mode.toUpperCase() : "—"}</>;
}

async function AccountStats({ promise }: { promise: Promise<AccountSnapshot> }) {
  const account = await promise;
  return (
    <>
      <Stat
        label="Account equity"
        delay={0.02}
        sub={`${money(account.available)} available`}
        className="text-[var(--color-ink)]"
      >
        {money(account.equity)}
      </Stat>
      <Stat
        label="Unrealized"
        delay={0.06}
        sub={`${account.positions.length} open position${account.positions.length === 1 ? "" : "s"}`}
        className={TONE_CLASS[tone(account.unrealizedPnl)]}
      >
        {money(account.unrealizedPnl, { signed: true })}
      </Stat>
    </>
  );
}

async function Allowance({ promise }: { promise: Promise<Limits> }) {
  const limits = await promise;
  const period = limitPeriod(limits);
  return (
      <Reveal delay={0.05}>
        <Card className="p-6">
          <SectionTitle
            title={period.weekly ? "This week's allowance" : "Today's allowance"}
            hint={`Resets ${new Date(limits.resetsAt).toUTCString().slice(0, 22)} UTC`}
            right={
              limits.tradingHalted ? (
                <span className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-warning)]">
                  {period.weekly ? "Halted this week" : "Halted for today"}
                </span>
              ) : (
                <span className="rounded-lg border border-[var(--color-mint-dim)] bg-[var(--color-mint)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-mint)]">
                  Trading
                </span>
              )
            }
          />
          <div className="grid gap-6 md:grid-cols-2">
            {period.profitOn ? (
              <Gauge used={limits.profitUsed} limit={limits.profitLimit} intent="good" label="Profit target used" />
            ) : (
              <Gauge used={limits.drawdown} limit={limits.drawdownLimit} intent="bad" label="Drawdown from peak" />
            )}
            <Gauge used={limits.lossUsed} limit={limits.lossLimit} intent="bad" label="Loss allowance used" />
          </div>
          <div className="text-[var(--color-ink-muted)] mt-5 grid gap-3 text-xs sm:grid-cols-3">
            <div>
              {period.opened} <span className="tabular text-[var(--color-ink-secondary)]">{money(limits.dayStartEquity)}</span>
            </div>
            <div>
              Now <span className="tabular text-[var(--color-ink-secondary)]">{money(limits.currentEquity)}</span>
            </div>
            <div>
              Room left{" "}
              <span className="tabular text-[var(--color-ink-secondary)]">
                {period.profitOn && `${percent(limits.profitRemaining)} up · `}
                {percent(limits.lossRemaining)} down
              </span>
            </div>
          </div>
        </Card>
      </Reveal>
  );
}

/**
 * The cumulative series, on BTCUSDT's 4h grid when the lake covers the whole
 * window, otherwise on the trades alone.
 *
 * On a regular grid the two lines share their x positions, and a trade-only
 * series would draw long straight lines across days with nothing in them.
 * PnL steps: its value at a grid point is everything closed by then.
 */
function cumulativeSeries(analytics: Analytics, candles: Candle[]): {
  points: CumulativePoint[];
  showBtc: boolean;
} {
  const since = Date.parse(analytics.since);
  const now = Date.now();
  const base = analytics.openingEquity;
  const share = (pnl: number) => (base > 0 ? (pnl / base) * 100 : 0);
  const trades = analytics.equityCurve.map((p) => ({ t: Date.parse(p.t), pnl: p.equity - base }));
  const pnlAt = (t: number) => {
    let value = 0;
    for (const trade of trades) {
      if (trade.t > t) break;
      value = trade.pnl;
    }
    return value;
  };

  const bar = 4 * 60 * 60 * 1000;
  const anchor = [...candles].reverse().find((c) => c.t <= since);
  if (!anchor || candles.length < 2) {
    const points: CumulativePoint[] = [{ t: since, pnl: 0, pct: 0, btc: null }];
    for (const trade of trades) points.push({ t: trade.t, pnl: trade.pnl, pct: share(trade.pnl), btc: null });
    const last = trades.at(-1)?.pnl ?? 0;
    points.push({ t: now, pnl: last, pct: share(last), btc: null });
    return { points, showBtc: false };
  }

  const points: CumulativePoint[] = [{ t: since, pnl: 0, pct: 0, btc: 0 }];
  for (const candle of candles) {
    const close = Math.min(candle.t + bar, now);
    if (close <= since) continue;
    const pnl = pnlAt(close);
    points.push({ t: close, pnl, pct: share(pnl), btc: (candle.c / anchor.c - 1) * 100 });
  }
  return { points, showBtc: true };
}

async function CumulativeCharts({
  promise,
  btc,
}: {
  promise: Promise<Analytics>;
  btc: Promise<{ candles: Candle[] }>;
}) {
  const [analytics, benchmark] = await Promise.all([promise, btc]);
  const { points, showBtc } = cumulativeSeries(analytics, benchmark.candles);
  const last = points.at(-1) ?? { pnl: 0, pct: 0, btc: null };

  return (
    <>
      <Reveal delay={0.05}>
        <Card className="p-6" hoverable={false}>
          <SectionTitle title="Cumulative PnL" hint="Realised, after fees" />
          <div className={`tabular -mt-2 mb-4 text-2xl font-semibold ${TONE_CLASS[tone(last.pnl)]}`}>
            {money(last.pnl, { signed: true })}
          </div>
          {analytics.equityCurve.length ? (
            <CumulativePnlChart data={points} />
          ) : (
            <EmptyState title="No closed trades in this window" />
          )}
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="p-6" hoverable={false}>
          <SectionTitle title="Cumulative PnL %" hint={`On ${money(analytics.openingEquity)} at period start`} />
          <div className="-mt-2 mb-4 flex flex-wrap gap-x-8 gap-y-2">
            <Legend colour={CUMULATIVE_COLOURS.pnl} label="PnL %" value={last.pct} />
            {showBtc && last.btc !== null && (
              <Legend colour={CUMULATIVE_COLOURS.btc} label="BTCUSDT" value={last.btc} />
            )}
          </div>
          <CumulativePctChart data={points} showBtc={showBtc} />
        </Card>
      </Reveal>
    </>
  );
}

/** Daily and per-symbol breakdowns. Own boundary: they need only the
 *  analytics, never the BTC benchmark. */
async function BreakdownCharts({ promise }: { promise: Promise<Analytics> }) {
  const analytics = await promise;
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal delay={0.04}>
          <Card className="p-6" hoverable={false}>
            <SectionTitle title="Daily net PnL" hint="UTC days" />
            {analytics.daily.length ? (
              <DailyPnlChart data={analytics.daily} />
            ) : (
              <EmptyState title="No days to show yet" />
            )}
          </Card>
        </Reveal>
        <Reveal delay={0.08}>
          <Card className="p-6" hoverable={false}>
            <SectionTitle title="By symbol" hint="Worst first" />
            {analytics.bySymbol.length ? (
              <SymbolChart data={analytics.bySymbol} />
            ) : (
              <EmptyState title="No symbols traded yet" />
            )}
          </Card>
        </Reveal>
      </div>
    </>
  );
}

/** A legend entry that also carries the latest value, as Binance's does:
 *  the swatch names the line, the number stays in text ink. */
function Legend({ colour, label, value }: { colour: string; label: string; value: number }) {
  return (
    <div>
      <div className={`tabular text-2xl font-semibold ${TONE_CLASS[tone(value)]}`}>
        {percent(value / 100, { signed: true })}
      </div>
      <div className="text-[var(--color-ink-secondary)] mt-1 flex items-center gap-2 text-xs">
        <span className="h-0.5 w-4 rounded-full" style={{ background: colour }} /> {label}
      </div>
    </div>
  );
}

async function RouteSection({
  promise,
  days,
}: {
  promise: Promise<{ routes: RouteStats[] }>;
  days: number | string;
}) {
  // A failed route read must not take the dashboard down: it is the newest
  // panel on the page and the least load-bearing.
  const data = await promise.catch(() => ({ routes: [] as RouteStats[] }));
  return <RouteCards routes={data.routes} days={days} />;
}

/**
 * The two headline numbers that need the window's whole history.
 *
 * Awaiting the promise INSIDE a Suspense boundary is what lets the rest of
 * the page paint without it. The promise itself was started by the page
 * before it awaited anything, so this is not a sequential second fetch — it
 * has been in flight the whole time.
 */
async function HeadlinePnl({ promise }: { promise: Promise<Analytics> }) {
  const analytics = await promise;
  const p = analytics.performance;
  return (
    <>
      <Stat
        label="Net PnL"
        delay={0.1}
        sub={`${money(p.grossPnl, { signed: true })} gross · ${money(Math.abs(p.fees))} fees`}
        className={TONE_CLASS[tone(p.netPnl)]}
      >
        {money(p.netPnl, { signed: true })}
      </Stat>
      <Stat
        label="ROI"
        delay={0.14}
        sub={`on ${money(analytics.openingEquity)} at period start`}
        className={TONE_CLASS[tone(p.roi)]}
      >
        {percent(p.roi, { signed: true })}
      </Stat>
    </>
  );
}

/** The eight performance cards, above every chart. */
async function PerformanceStats({ promise }: { promise: Promise<Analytics> }) {
  const analytics = await promise;
  const p = analytics.performance;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Win rate" delay={0.02} sub={`${p.wins}W / ${p.losses}L of ${p.trades}`}>
          {(p.winRate * 100).toFixed(1)}%
        </Stat>
        <Stat
          label="Profit factor"
          delay={0.06}
          sub="Gross wins ÷ gross losses"
          className={p.profitFactor >= 1 ? TONE_CLASS.profit : TONE_CLASS.loss}
        >
          {p.profitFactor.toFixed(2)}
        </Stat>
        <Stat
          label="Average trade"
          delay={0.1}
          sub={`${money(p.averageWin, { signed: true })} win · ${money(p.averageLoss, { signed: true })} loss`}
          className={TONE_CLASS[tone(p.averageTrade)]}
        >
          {money(p.averageTrade, { signed: true })}
        </Stat>
        <Stat
          label="Max drawdown"
          delay={0.14}
          sub="Peak to trough, closed PnL"
          className={TONE_CLASS.loss}
        >
          {money(p.maxDrawdown)}
        </Stat>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Best trade" delay={0.02} className={TONE_CLASS.profit}>
          {money(p.bestTrade, { signed: true })}
        </Stat>
        <Stat label="Worst trade" delay={0.06} className={TONE_CLASS.loss}>
          {money(p.worstTrade, { signed: true })}
        </Stat>
        <Stat label="Longest streak" delay={0.1} sub="wins / losses in a row">
          {p.longestWinStreak} / {p.longestLossStreak}
        </Stat>
        <Stat label="Average hold" delay={0.14} sub="Entry to exit">
          {duration(p.averageDurationMinutes)}
        </Stat>
      </div>
    </>
  );
}
