import { ArrowRight } from "lucide-react";

import { Badge, Card, EmptyState, Reveal, SectionTitle, Stat } from "@/components/ui";
import { botFetch, type ClosedTrade } from "@/lib/bot-api";
import {
  TONE_CLASS,
  duration,
  money,
  percent,
  price,
  quantity,
  tone,
  utcDateTime,
} from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days = "30" } = await searchParams;
  const { trades } = await botFetch<{ trades: ClosedTrade[] }>(`/api/history?days=${days}`);

  const net = trades.reduce((sum, t) => sum + t.netPnl, 0);
  const wins = trades.filter((t) => t.netPnl > 0).length;
  const fees = trades.reduce((sum, t) => sum + t.commission - t.funding, 0);

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
            <h1 className="text-3xl font-semibold tracking-tight">Trade history</h1>
            <p className="text-[var(--color-ink-secondary)] mt-2 text-sm">
              Every closed round trip, with both ends: when it opened and when it closed.
            </p>
          </div>
          <div className="glass flex gap-1 rounded-xl p-1">
            {ranges.map((range) => (
              <a
                key={range.value}
                href={`/history?days=${range.value}`}
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Closed trades" delay={0.02} sub={`${wins}W / ${trades.length - wins}L`}>
          {trades.length}
        </Stat>
        <Stat label="Net PnL" delay={0.06} className={TONE_CLASS[tone(net)]} sub="after fees and funding">
          {money(net, { signed: true })}
        </Stat>
        <Stat
          label="Win rate"
          delay={0.1}
          sub="share of trades that ended positive"
        >
          {trades.length ? ((wins / trades.length) * 100).toFixed(1) : "0.0"}%
        </Stat>
        <Stat label="Fees paid" delay={0.14} className={TONE_CLASS.loss} sub="commission net of funding">
          {money(fees)}
        </Stat>
      </div>

      <Reveal delay={0.04}>
        <Card className="overflow-hidden" hoverable={false}>
          <div className="p-6 pb-4">
            <SectionTitle
              title="Round trips"
              hint="Newest first. Reconstructed from fills — Binance stores fills and income, never the trade."
            />
          </div>

          {trades.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[980px] text-sm">
                <thead>
                  <tr className="border-y border-[var(--color-border)] text-[var(--color-ink-muted)] text-[10px] tracking-[0.12em] uppercase">
                    <th className="px-6 py-3 text-left font-medium">Symbol</th>
                    <th className="px-4 py-3 text-left font-medium">Opened → closed (UTC)</th>
                    <th className="px-4 py-3 text-right font-medium">Held</th>
                    <th className="px-4 py-3 text-right font-medium">Entry</th>
                    <th className="px-4 py-3 text-right font-medium">Exit</th>
                    <th className="px-4 py-3 text-right font-medium">Size</th>
                    <th className="px-4 py-3 text-right font-medium">Fees</th>
                    <th className="px-4 py-3 text-right font-medium">ROI</th>
                    <th className="px-6 py-3 text-right font-medium">Net PnL</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade, index) => (
                    <tr
                      key={`${trade.symbol}-${trade.closedAt}-${index}`}
                      className="border-b border-[var(--color-border)]/60 transition-colors hover:bg-[var(--color-surface-overlay)]/60"
                    >
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span className="font-medium">{trade.symbol}</span>
                          <Badge intent={trade.side === "long" ? "long" : "short"}>
                            {trade.side}
                          </Badge>
                        </div>
                      </td>
                      <td className="text-[var(--color-ink-secondary)] px-4 py-3.5">
                        <span className="tabular inline-flex items-center gap-2 text-xs">
                          {utcDateTime(trade.openedAt)}
                          <ArrowRight className="text-[var(--color-ink-muted)] h-3 w-3" />
                          {utcDateTime(trade.closedAt)}
                        </span>
                      </td>
                      <td className="tabular text-[var(--color-ink-secondary)] px-4 py-3.5 text-right text-xs">
                        {duration(trade.durationMinutes)}
                      </td>
                      <td className="tabular text-[var(--color-ink-secondary)] px-4 py-3.5 text-right text-xs">
                        {price(trade.entryPrice)}
                      </td>
                      <td className="tabular text-[var(--color-ink-secondary)] px-4 py-3.5 text-right text-xs">
                        {price(trade.exitPrice)}
                      </td>
                      <td className="tabular text-[var(--color-ink-muted)] px-4 py-3.5 text-right text-xs">
                        {quantity(trade.quantity)}
                      </td>
                      <td className="tabular text-[var(--color-ink-muted)] px-4 py-3.5 text-right text-xs">
                        {money(trade.commission - trade.funding, { digits: 4 })}
                      </td>
                      <td
                        className={`tabular px-4 py-3.5 text-right text-xs ${TONE_CLASS[tone(trade.roi)]}`}
                      >
                        {percent(trade.roi, { signed: true })}
                      </td>
                      <td
                        className={`tabular px-6 py-3.5 text-right font-semibold ${TONE_CLASS[tone(trade.netPnl)]}`}
                      >
                        {money(trade.netPnl, { signed: true })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 pt-0">
              <EmptyState
                title="No closed trades in this window"
                hint="Widen the range, or wait for an open position to close."
              />
            </div>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
