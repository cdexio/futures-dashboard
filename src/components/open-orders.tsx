"use client";

import { useEffect, useState } from "react";
import { ListOrdered } from "lucide-react";

import { Badge } from "@/components/ui";
import type { OpenOrder } from "@/lib/bot-api";
import { price, quantity, relative } from "@/lib/format";

const KIND: Record<OpenOrder["kind"], { label: string; intent: "good" | "bad" | "warn" | "neutral" }> =
  {
    entry: { label: "entry — waiting to fill", intent: "warn" },
    stop: { label: "stop", intent: "bad" },
    take_profit: { label: "take profit", intent: "good" },
    exit: { label: "exit", intent: "neutral" },
    manual: { label: "not placed by the bot", intent: "neutral" },
  };

/** When the engine cancels an unfilled entry: the next 30-minute bar's cycle,
 *  which starts about four minutes after the bar closes. An estimate — the
 *  cycle, not a timer, does the cancelling — and labelled as one ("~"). */
function expiresAt(placedAt: string): string {
  const bar = 30 * 60 * 1000;
  const next = Math.floor(Date.parse(placedAt) / bar) * bar + bar + 4 * 60 * 1000;
  return new Date(next).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });
}

/**
 * What is resting on the exchange right now.
 *
 * WHY IT EXISTS. On 2026-09-23 three post-only entries — HEIUSDT, VELVETUSDT,
 * SYNUSDT — sat on the book for half an hour while this page showed one open
 * position and nothing else. The engine had acted; the page could not say so,
 * and the owner read it as the bot doing nothing.
 *
 * ENTRIES FIRST, because they are the ones that answer "is it trying". Stops
 * and take-profits are listed too, grouped under the entries, since a
 * position without its protection is the one state this system must never be
 * in and this is the only place a reader can check it at a glance.
 *
 * An entry that is still here at the next 30-minute bar is cancelled by the
 * engine — the signal described a price that has since moved — and it leaves
 * no cooldown behind, because nothing was traded.
 */
export function OpenOrders() {
  const [orders, setOrders] = useState<OpenOrder[] | null>(null);
  const [asOf, setAsOf] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch("/api/orders", { cache: "no-store" });
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { orders: OpenOrder[]; asOf: string | null };
        if (alive) {
          setOrders(body.orders);
          setAsOf(body.asOf);
          setFailed(false);
        }
      } catch {
        if (alive) setFailed(true);
      }
    };
    void tick();
    // The API caches this for twenty seconds — it costs 80 of the per-IP
    // weight the trader shares — so polling faster would only redraw it.
    const timer = setInterval(tick, 20000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const entries = (orders ?? []).filter((o) => o.kind === "entry");
  const rest = (orders ?? []).filter((o) => o.kind !== "entry");

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ListOrdered className="h-4 w-4 text-[var(--color-solana-bright)]" />
          <h2 className="text-lg font-semibold tracking-tight">Open orders</h2>
        </div>
        {failed ? (
          <span className="text-xs text-[var(--color-loss)]">Unreachable</span>
        ) : orders ? (
          <span className="text-[var(--color-ink-muted)] text-xs">
            {entries.length} entr{entries.length === 1 ? "y" : "ies"} waiting · {rest.length}{" "}
            protective{asOf ? ` · ${relative(asOf)}` : ""}
          </span>
        ) : null}
      </div>

      {orders === null ? (
        <p className="text-[var(--color-ink-muted)] py-4 text-center text-xs">Reading the book…</p>
      ) : !orders.length ? (
        <p className="text-[var(--color-ink-muted)] py-4 text-center text-xs">
          No open orders.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-xs">
            <thead>
              <tr className="text-[var(--color-ink-muted)] text-left text-[10px] tracking-[0.12em] uppercase">
                <th className="py-2 pr-3 font-medium">Symbol</th>
                <th className="py-2 pr-3 font-medium">For</th>
                <th className="py-2 pr-3 text-right font-medium">Price</th>
                <th className="py-2 pr-3 text-right font-medium">Size</th>
                <th className="py-2 text-right font-medium">Placed</th>
              </tr>
            </thead>
            <tbody>
              {[...entries, ...rest].map((order, index) => {
                const shape = KIND[order.kind] ?? KIND.manual;
                const notional =
                  order.price !== null && order.quantity !== null
                    ? order.price * order.quantity
                    : null;
                return (
                  <tr
                    key={`${order.symbol}-${order.kind}-${order.price}-${index}`}
                    className="border-t border-[var(--color-border)]/60"
                  >
                    <td className="py-2 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{order.symbol}</span>
                        <Badge intent={order.side === "buy" ? "long" : "short"}>{order.side}</Badge>
                      </div>
                    </td>
                    <td className="py-2 pr-3">
                      <Badge intent={shape.intent}>{shape.label}</Badge>
                      {order.postOnly && (
                        <span className="text-[var(--color-ink-muted)] ml-1.5 text-[10px]">
                          maker
                        </span>
                      )}
                    </td>
                    <td className="tabular py-2 pr-3 text-right">
                      {order.price !== null ? price(order.price) : "market"}
                    </td>
                    <td className="tabular text-[var(--color-ink-secondary)] py-2 pr-3 text-right">
                      {order.quantity !== null ? quantity(order.quantity) : "—"}
                      {notional !== null && order.kind === "entry" && (
                        <span className="text-[var(--color-ink-muted)] ml-1 text-[10px]">
                          ${notional.toFixed(2)}
                        </span>
                      )}
                    </td>
                    <td className="text-[var(--color-ink-muted)] py-2 text-right">
                      {order.placedAt ? relative(order.placedAt) : "—"}
                      {order.kind === "entry" && order.placedAt && (
                        <span className="block text-[10px] text-[var(--color-warning)]">
                          cancelled ~{expiresAt(order.placedAt)} UTC if unfilled
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
