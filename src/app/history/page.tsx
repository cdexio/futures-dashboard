import { Download } from "lucide-react";

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
              Closed trades · last {days} days
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* The engine-vs-AI record, as files a spreadsheet opens. Plain
                links: the route answers with Content-Disposition, so the
                browser downloads rather than navigates. */}
            <a
              href={`/api/export/trades?days=${days}`}
              className="glass inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
              title="Closed trades with route, score and AI verdict"
            >
              <Download className="h-3.5 w-3.5" /> Trades CSV
            </a>
            <a
              href={`/api/export/verdicts?days=${days}`}
              className="glass inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-medium text-[var(--color-ink-secondary)] transition-colors hover:text-[var(--color-ink)]"
              title="All AI verdicts with price after 2/4/8h"
            >
              <Download className="h-3.5 w-3.5" /> AI verdicts CSV
            </a>
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
        </div>
      </Reveal>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Closed trades" delay={0.02} sub={`${wins}W / ${trades.length - wins}L`}>
          {trades.length}
        </Stat>
        <Stat label="Net PnL" delay={0.06} className={TONE_CLASS[tone(net)]} sub="after fees and funding">
          {money(net, { signed: true })}
        </Stat>
        <Stat label="Win rate" delay={0.1}>
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
              hint="Newest first · tap a row for details"
            />
          </div>

          {trades.length ? (
            <HistoryTable trades={trades} />
          ) : (
            <div className="p-6 pt-0">
              <EmptyState title="No closed trades in this window" />
            </div>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
