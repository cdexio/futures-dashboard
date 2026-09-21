import { Activity, Percent, Target, TrendingUp, Wallet } from "lucide-react";

import { DailyPnlChart, EquityChart, SymbolChart } from "@/components/charts";
import { Card, EmptyState, Gauge, LiveDot, Reveal, SectionTitle, Stat } from "@/components/ui";
import { botFetch, type Analytics, type AccountSnapshot, type Limits } from "@/lib/bot-api";
import { TONE_CLASS, duration, money, percent, tone } from "@/lib/format";

// The account moves while this page is open, so nothing here may be cached.
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days = "30" } = await searchParams;
  const [analytics, account, limits] = await Promise.all([
    botFetch<Analytics>(`/api/analytics?days=${days}`),
    botFetch<AccountSnapshot>("/api/account"),
    botFetch<Limits>("/api/limits"),
  ]);

  const p = analytics.performance;
  const ranges = [
    { label: "7D", value: "7" },
    { label: "30D", value: "30" },
    { label: "90D", value: "90" },
  ];

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
              Binance USDⓈ-M · {account.mode.toUpperCase()} · last {days} days
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

      {/* The hero row. Equity first because it is the only number that answers
          "how much do I have"; everything else explains how it got there. */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Account equity"
          delay={0.02}
          sub={`${money(account.available)} available`}
          className="text-[var(--color-ink)]"
        >
          {money(account.equity)}
        </Stat>
        <Stat
          label="Net PnL"
          delay={0.06}
          sub={`${money(p.grossPnl, { signed: true })} gross · ${money(Math.abs(p.fees))} fees`}
          className={TONE_CLASS[tone(p.netPnl)]}
        >
          {money(p.netPnl, { signed: true })}
        </Stat>
        <Stat
          label="ROI"
          delay={0.1}
          sub={`on ${money(analytics.openingEquity)} at period start`}
          className={TONE_CLASS[tone(p.roi)]}
        >
          {percent(p.roi, { signed: true })}
        </Stat>
        <Stat
          label="Unrealized"
          delay={0.14}
          sub={`${account.positions.length} open position${account.positions.length === 1 ? "" : "s"}`}
          className={TONE_CLASS[tone(account.unrealizedPnl)]}
        >
          {money(account.unrealizedPnl, { signed: true })}
        </Stat>
      </div>

      {/* Today's allowance. Above the charts because it is the only thing on
          this page that decides whether the bot may act in the next hour. */}
      <Reveal delay={0.05}>
        <Card className="p-6">
          <SectionTitle
            title="Today's allowance"
            hint={`Resets ${new Date(limits.resetsAt).toUTCString().slice(5, 22)} UTC`}
            right={
              limits.tradingHalted ? (
                <span className="rounded-lg border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-warning)]">
                  Halted for today
                </span>
              ) : (
                <span className="rounded-lg border border-[var(--color-mint-dim)] bg-[var(--color-mint)]/10 px-3 py-1.5 text-xs font-semibold text-[var(--color-mint)]">
                  Trading
                </span>
              )
            }
          />
          <div className="grid gap-6 md:grid-cols-2">
            <Gauge used={limits.profitUsed} limit={limits.profitLimit} intent="good" label="Profit target used" />
            <Gauge used={limits.lossUsed} limit={limits.lossLimit} intent="bad" label="Loss allowance used" />
          </div>
          <div className="text-[var(--color-ink-muted)] mt-5 grid gap-3 text-xs sm:grid-cols-3">
            <div>
              Day opened at <span className="tabular text-[var(--color-ink-secondary)]">{money(limits.dayStartEquity)}</span>
            </div>
            <div>
              Now <span className="tabular text-[var(--color-ink-secondary)]">{money(limits.currentEquity)}</span>
            </div>
            <div>
              Room left{" "}
              <span className="tabular text-[var(--color-ink-secondary)]">
                {percent(limits.profitRemaining)} up · {percent(limits.lossRemaining)} down
              </span>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.05}>
        <Card className="p-6" hoverable={false}>
          <SectionTitle
            title="Equity curve"
            hint="Balance after each closed trade. Unrealized PnL is excluded — it is not money until the position closes."
          />
          {analytics.equityCurve.length ? (
            <EquityChart data={analytics.equityCurve} />
          ) : (
            <EmptyState title="No closed trades in this window" />
          )}
        </Card>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal delay={0.04}>
          <Card className="p-6" hoverable={false}>
            <SectionTitle title="Daily net PnL" hint="UTC days — the same boundary the daily limits use." />
            {analytics.daily.length ? (
              <DailyPnlChart data={analytics.daily} />
            ) : (
              <EmptyState title="No days to show yet" />
            )}
          </Card>
        </Reveal>
        <Reveal delay={0.08}>
          <Card className="p-6" hoverable={false}>
            <SectionTitle title="By symbol" hint="Worst first — the question this answers is what is costing money." />
            {analytics.bySymbol.length ? (
              <SymbolChart data={analytics.bySymbol} />
            ) : (
              <EmptyState title="No symbols traded yet" />
            )}
          </Card>
        </Reveal>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Win rate" delay={0.02} sub={`${p.wins}W / ${p.losses}L of ${p.trades}`}>
          {(p.winRate * 100).toFixed(1)}%
        </Stat>
        <Stat
          label="Profit factor"
          delay={0.06}
          sub="Gross wins ÷ gross losses. Above 1 is profitable."
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
          sub="Deepest peak-to-trough fall in closed PnL"
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
    </div>
  );
}
