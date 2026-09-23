"use client";

import { ArrowRight } from "lucide-react";
import { useState } from "react";

import { PositionDetail, type DetailTarget } from "@/components/position-detail";
import { Badge } from "@/components/ui";
import type { ClosedTrade } from "@/lib/bot-api";
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

/**
 * The round-trip table, with every row a way into the detail panel.
 *
 * WHY THIS IS A CLIENT COMPONENT AND THE PAGE IS NOT. Only the selection is
 * interactive; the trades themselves are fetched on the server and handed down
 * already rendered-ready. Making the whole page client-side would move a
 * history read that walks every fill into the browser, and put the bot API's
 * address there with it.
 *
 * THE SAME PANEL AS THE OPEN POSITIONS, DELIBERATELY. A closed trade and an
 * open one are asked the same questions — which route opened it, what the
 * engine scored it, what the validator said, where the levels sat — and the
 * only honest difference is that one of them is over. Two components would
 * answer those questions differently within a month.
 */
export function HistoryTable({ trades }: { trades: ClosedTrade[] }) {
  const [selected, setSelected] = useState<DetailTarget | null>(null);

  return (
    <>
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
                // A row, not a button, because a button inside a table cell
                // cannot span the row and half the width would not respond.
                // The keyboard path is kept explicitly below rather than lost.
                role="button"
                tabIndex={0}
                onClick={() => setSelected(toTarget(trade))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelected(toTarget(trade));
                  }
                }}
                className="cursor-pointer border-b border-[var(--color-border)]/60 transition-colors hover:bg-[var(--color-surface-overlay)]/60 focus:bg-[var(--color-surface-overlay)]/60 focus:outline-none"
              >
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-medium">{trade.symbol}</span>
                    <Badge intent={trade.side === "long" ? "long" : "short"}>{trade.side}</Badge>
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

      <PositionDetail target={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/** A closed trade in the shape the panel reads.
 *
 *  `stopPrice` and `takeProfitPrice` are deliberately absent rather than
 *  invented: a closed trade's resting orders are gone, and the levels it ran
 *  with were never written to the trade record. The panel prints a dash, which
 *  is true, instead of the exit price dressed as a target. */
function toTarget(trade: ClosedTrade): DetailTarget {
  return {
    symbol: trade.symbol,
    side: trade.side,
    entryPrice: trade.entryPrice,
    exitPrice: trade.exitPrice,
    openedAt: trade.openedAt,
    closedAt: trade.closedAt,
    realizedPnl: trade.netPnl,
    notional: trade.notional,
    quantity: trade.quantity,
    roi: trade.roi,
    grossPnl: trade.realizedPnl,
    fees: trade.commission,
    funding: trade.funding,
    durationMinutes: trade.durationMinutes,
  };
}
