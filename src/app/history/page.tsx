import { HistoryTable } from "@/components/history-table";
import { Card, EmptyState, Reveal, SectionTitle, Stat } from "@/components/ui";
import { botFetch, type ClosedTrade } from "@/lib/bot-api";
import { TONE_CLASS, money, tone } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  // SEVEN DAYS, not thirty. Measured 2026-09-22 against the live API:
  // `history?days=7` answers in 0.56 s, `days=30` in 1.9 s and `days=90` in
  // 5.1 s. The longer windows are one click away and cached for fifteen
  // minutes once somebody asks; a default is what a reader pays for without
  // deciding to.
  const { days = "7" } = await searchParams;
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
              hint="Newest first. Reconstructed from fills — Binance stores fills and income, never the trade. Click a row for the chart, the route and what the validator said."
            />
          </div>

          {trades.length ? (
            <HistoryTable trades={trades} />
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
