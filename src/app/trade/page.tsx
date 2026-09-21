import { ShieldAlert, ShieldCheck } from "lucide-react";

import { LiveFeed } from "@/components/live-feed";
import { Badge, Card, EmptyState, Gauge, Reveal, SectionTitle, Stat } from "@/components/ui";
import {
  botFetch,
  type AccountSnapshot,
  type ActivityEvent,
  type Analytics,
  type Limits,
} from "@/lib/bot-api";
import { TONE_CLASS, money, percent, price, quantity, tone, utcTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TradePage() {
  const [account, limits, analytics, activity] = await Promise.all([
    botFetch<AccountSnapshot>("/api/account"),
    botFetch<Limits>("/api/limits"),
    botFetch<Analytics>("/api/analytics?days=1"),
    botFetch<{ events: ActivityEvent[] }>("/api/activity"),
  ]);

  return (
    <div className="space-y-8">
      <Reveal>
        <h1 className="text-3xl font-semibold tracking-tight">Trade</h1>
        <p className="text-[var(--color-ink-secondary)] mt-2 text-sm">
          Open positions, today&apos;s result, and what the agent is doing right now.
        </p>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Realized PnL · today"
          delay={0.02}
          sub={`${analytics.performance.trades} closed`}
          className={TONE_CLASS[tone(analytics.performance.netPnl)]}
        >
          {money(analytics.performance.netPnl, { signed: true })}
        </Stat>
        <Stat
          label="Unrealized PnL"
          delay={0.06}
          sub="Open positions, marked to market"
          className={TONE_CLASS[tone(account.unrealizedPnl)]}
        >
          {money(account.unrealizedPnl, { signed: true })}
        </Stat>
        <Stat
          label="ROI · today"
          delay={0.1}
          sub={`on ${money(limits.dayStartEquity)} at 00:00 UTC`}
          className={TONE_CLASS[tone(limits.currentEquity - limits.dayStartEquity)]}
        >
          {percent(
            limits.dayStartEquity
              ? (limits.currentEquity - limits.dayStartEquity) / limits.dayStartEquity
              : 0,
            { signed: true },
          )}
        </Stat>
        <Stat
          label="Trading room left"
          delay={0.14}
          sub={`resets 00:00 UTC · ${percent(limits.lossRemaining)} down`}
          className={limits.tradingHalted ? TONE_CLASS.loss : TONE_CLASS.profit}
        >
          {percent(limits.profitRemaining)}
        </Stat>
      </div>

      <Reveal delay={0.04}>
        <Card className="p-6">
          <SectionTitle
            title="Daily limits"
            hint="A 24-hour window on the UTC clock. Both stops end the day, not the position."
          />
          <div className="grid gap-6 md:grid-cols-2">
            <Gauge used={limits.profitUsed} limit={limits.profitLimit} intent="good" label="Profit target" />
            <Gauge used={limits.lossUsed} limit={limits.lossLimit} intent="bad" label="Loss allowance" />
          </div>
        </Card>
      </Reveal>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <Reveal delay={0.04}>
          <Card className="p-6" hoverable={false}>
            <SectionTitle
              title={`Open positions · ${account.positions.length}`}
              hint="Every position should carry a stop. One that does not is the single state this system must never be in."
            />
            {account.positions.length ? (
              <div className="space-y-3">
                {account.positions.map((position) => {
                  const up = position.unrealizedPnl >= 0;
                  return (
                    <div
                      key={position.symbol}
                      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]/60 p-4 transition-colors hover:border-[var(--color-border-strong)]"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold tracking-tight">{position.symbol}</span>
                          <Badge intent={position.side === "long" ? "long" : "short"}>
                            {position.side}
                          </Badge>
                          {position.protected ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-mint)]">
                              <ShieldCheck className="h-3 w-3" /> protected
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-loss)]">
                              <ShieldAlert className="h-3 w-3" /> no stop
                            </span>
                          )}
                        </div>
                        <span
                          className={`tabular text-lg font-semibold ${up ? TONE_CLASS.profit : TONE_CLASS.loss}`}
                        >
                          {money(position.unrealizedPnl, { signed: true })}
                        </span>
                      </div>

                      <div className="text-[var(--color-ink-muted)] mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5 text-xs sm:grid-cols-4">
                        <Field label="Size" value={`${quantity(position.quantity)}`} />
                        <Field label="Entry" value={price(position.entryPrice)} />
                        <Field label="Notional" value={money(position.notional)} />
                        <Field
                          label="Stop"
                          value={position.stopPrice ? price(position.stopPrice) : "—"}
                          tone={position.stopPrice ? "loss" : undefined}
                        />
                        <Field
                          label="Take profit"
                          value={position.takeProfitPrice ? price(position.takeProfitPrice) : "—"}
                          tone={position.takeProfitPrice ? "profit" : undefined}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Flat"
                hint="No open positions. The agent opens on the next signal that clears every guard."
              />
            )}
            <p className="text-[var(--color-ink-muted)] mt-4 text-[11px]">
              As of {utcTime(account.asOf)} UTC
            </p>
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="p-6" hoverable={false}>
            <LiveFeed initial={activity.events} />
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  tone: t,
}: {
  label: string;
  value: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div>
      <div className="text-[10px] tracking-wide uppercase">{label}</div>
      <div
        className={`tabular mt-1 text-sm ${t ? TONE_CLASS[t] : "text-[var(--color-ink-secondary)]"}`}
      >
        {value}
      </div>
    </div>
  );
}
