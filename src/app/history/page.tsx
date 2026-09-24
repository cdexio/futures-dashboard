import { ChevronLeft, ChevronRight, Download } from "lucide-react";

import { HistoryTable } from "@/components/history-table";
import { Card, EmptyState, Reveal, SectionTitle, Stat } from "@/components/ui";
import { botFetch, type ClosedTrade } from "@/lib/bot-api";
import { TONE_CLASS, money, tone } from "@/lib/format";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const PAGE_SIZE = 20;

function Pager({
  days,
  page,
  pages,
  total,
}: {
  days: string;
  page: number;
  pages: number;
  total: number;
}) {
  const from = (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const link = (target: number, label: React.ReactNode, disabled: boolean) =>
    disabled ? (
      <span className="text-[var(--color-ink-muted)] flex items-center gap-1 rounded-lg px-3 py-1.5 opacity-40">
        {label}
      </span>
    ) : (
      <a
        href={`/history?days=${days}&page=${target}`}
        className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-[var(--color-ink-secondary)] transition-colors hover:bg-[var(--color-surface-overlay)] hover:text-[var(--color-ink)]"
      >
        {label}
      </a>
    );

  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-6 py-3 text-xs">
      <span className="text-[var(--color-ink-muted)] tabular">
        {from}–{to} of {total}
      </span>
      <div className="flex items-center gap-1">
        {link(page - 1, <><ChevronLeft className="h-3.5 w-3.5" /> Prev</>, page <= 1)}
        <span className="tabular text-[var(--color-ink-muted)] px-2">
          {page} / {pages}
        </span>
        {link(page + 1, <>Next <ChevronRight className="h-3.5 w-3.5" /></>, page >= pages)}
      </div>
    </div>
  );
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string; page?: string }>;
}) {
  // SEVEN DAYS, not thirty. Measured 2026-09-22 against the live API:
  // `history?days=7` answers in 0.56 s, `days=30` in 1.9 s and `days=90` in
  // 5.1 s. The longer windows are one click away and cached for fifteen
  // minutes once somebody asks; a default is what a reader pays for without
  // deciding to.
  const { days = "7", page: rawPage = "1" } = await searchParams;
  const { trades } = await botFetch<{ trades: ClosedTrade[] }>(`/api/history?days=${days}`);

  // The totals are over the whole window; only the table is paged. A 90-day
  // window is hundreds of rows, and rendering them all is what made the page
  // heavy on a phone — the data itself is one cached read either way.
  const net = trades.reduce((sum, t) => sum + t.netPnl, 0);
  const wins = trades.filter((t) => t.netPnl > 0).length;
  const fees = trades.reduce((sum, t) => sum + t.commission - t.funding, 0);

  const newestFirst = [...trades].sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt));
  const pages = Math.max(1, Math.ceil(newestFirst.length / PAGE_SIZE));
  const page = Math.min(pages, Math.max(1, Number.parseInt(rawPage, 10) || 1));
  const shown = newestFirst.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
            <>
              <HistoryTable trades={shown} />
              <Pager days={days} page={page} pages={pages} total={trades.length} />
            </>
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
