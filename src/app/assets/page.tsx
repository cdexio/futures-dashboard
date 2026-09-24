import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

import { Card, EmptyState, Reveal, SectionTitle, Stat } from "@/components/ui";
import { botFetch, type AccountSnapshot, type Assets } from "@/lib/bot-api";
import { TONE_CLASS, money, percent, tone, utcDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/** Income types that are the ACCOUNT's own money moving, not trading results.
 *  Kept apart because a deposit absorbed into ROI reads as profit. */
const CASHFLOW = new Set(["TRANSFER", "WELCOME_BONUS", "COIN_SWAP_DEPOSIT"]);

export default async function AssetsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // Seven days by default, for the same reason as the other two pages: the
  // 30-day window costs several seconds of a page that cannot paint until it
  // arrives, and nobody chose it.
  const { days = "7" } = await searchParams;
  const [assets, account] = await Promise.all([
    botFetch<Assets>(`/api/assets?days=${days}`),
    botFetch<AccountSnapshot>("/api/account"),
  ]);

  const deployed = assets.equity > 0 ? assets.inPositions / assets.equity : 0;
  const tradingIncome = Object.entries(assets.incomeTotals).filter(([type]) => !CASHFLOW.has(type));
  const movements = assets.transfers;
  const netTransferred = movements.reduce((sum, m) => sum + m.amount, 0);

  return (
    <div className="space-y-8">
      <Reveal>
        <h1 className="text-3xl font-semibold tracking-tight">Assets</h1>
        <p className="text-[var(--color-ink-secondary)] mt-2 text-sm">
          Futures wallet and transfers
        </p>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Total equity" delay={0.02} sub="wallet plus unrealized">
          {money(assets.equity)}
        </Stat>
        <Stat label="Available" delay={0.06} sub="free margin">
          {money(assets.available)}
        </Stat>
        <Stat label="In positions" delay={0.1} sub={`${percent(deployed)} of equity deployed`}>
          {money(assets.inPositions)}
        </Stat>
        <Stat
          label="Net transferred"
          delay={0.14}
          sub="deposits − withdrawals"
          className={TONE_CLASS[tone(netTransferred)]}
        >
          {money(netTransferred, { signed: true })}
        </Stat>
      </div>

      <Reveal delay={0.04}>
        <Card className="p-6">
          <SectionTitle title="Capital deployment" hint="Margin in use" />
          <div className="h-3 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-solana)] to-[var(--color-mint)]"
              style={{ width: `${Math.min(100, deployed * 100)}%` }}
            />
          </div>
          <div className="text-[var(--color-ink-muted)] mt-3 flex justify-between text-xs">
            <span>{money(assets.inPositions)} committed</span>
            <span>{money(assets.available)} idle</span>
          </div>

          {account.positions.length > 0 && (
            <div className="mt-6 space-y-2">
              {account.positions.map((position) => (
                <div
                  key={position.symbol}
                  className="flex items-center justify-between rounded-lg border border-[var(--color-border)] px-4 py-2.5 text-sm"
                >
                  <span className="font-medium">{position.symbol}</span>
                  <span className="tabular text-[var(--color-ink-secondary)] text-xs">
                    {money(position.notional)} notional
                  </span>
                  <span
                    className={`tabular text-xs font-medium ${TONE_CLASS[tone(position.unrealizedPnl)]}`}
                  >
                    {money(position.unrealizedPnl, { signed: true })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal delay={0.04}>
          <Card className="p-6" hoverable={false}>
            <SectionTitle title="Transfers" hint="Deposits and withdrawals" />
            {movements.length ? (
              <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
                {movements.map((movement, index) => {
                  const incoming = movement.amount >= 0;
                  return (
                    <div
                      key={`${movement.at}-${index}`}
                      className="flex items-center gap-3 rounded-lg border border-[var(--color-border)] px-4 py-2.5"
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                          incoming
                            ? "bg-[var(--color-mint)]/12 text-[var(--color-mint)]"
                            : "bg-[var(--color-loss)]/12 text-[var(--color-loss)]"
                        }`}
                      >
                        {incoming ? (
                          <ArrowDownLeft className="h-3.5 w-3.5" />
                        ) : (
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium">
                          {incoming ? "Transfer in" : "Transfer out"}
                        </div>
                        <div className="text-[var(--color-ink-muted)] text-[11px]">
                          {utcDateTime(movement.at)} UTC
                        </div>
                      </div>
                      <span
                        className={`tabular text-sm font-semibold ${TONE_CLASS[tone(movement.amount)]}`}
                      >
                        {money(movement.amount, { signed: true, digits: 4 })}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No transfers in this window" />
            )}
          </Card>
        </Reveal>

        <Reveal delay={0.08}>
          <Card className="p-6" hoverable={false}>
            <SectionTitle title="Income breakdown" hint="By Binance category" />
            <div className="space-y-1.5">
              {tradingIncome.map(([type, amount]) => (
                <div
                  key={type}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-surface-overlay)]"
                >
                  <span className="text-[var(--color-ink-secondary)] text-xs">
                    {type.replace(/_/g, " ").toLowerCase()}
                  </span>
                  <span className={`tabular text-sm font-medium ${TONE_CLASS[tone(amount)]}`}>
                    {money(amount, { signed: true, digits: 4 })}
                  </span>
                </div>
              ))}
              {!tradingIncome.length && <EmptyState title="No income recorded in this window" />}
            </div>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
