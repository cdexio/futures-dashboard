"use client";

import { useEffect, useRef } from "react";

/**
 * TradingView's Advanced Chart widget for one USDⓈ-M perpetual.
 *
 * Replaced the lake-backed candle chart on 2026-09-25 at the owner's request:
 * the panel opened on "Reading the lake…" while the engine API was busy, and
 * TradingView loads straight from TradingView in the browser — no request to
 * this server and none to Binance, so it spends none of the IP's weight.
 *
 * What it cannot do is draw the bot's own levels; entry, stop and target stay
 * listed as numbers right under the chart.
 */
export function TradingViewChart({
  symbol,
  interval,
  height = 420,
}: {
  symbol: string;
  /** TradingView's interval: "60", "120", "240" or "D". */
  interval: string;
  height?: number;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = host.current;
    if (!node) return;
    // The widget builds its iframe from a <script> carrying its config as
    // text; a fresh one per symbol/interval is how the embed is meant to be
    // reconfigured.
    node.innerHTML = "";
    const widget = document.createElement("div");
    widget.className = "tradingview-widget-container__widget";
    widget.style.height = "100%";
    widget.style.width = "100%";
    node.appendChild(widget);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.textContent = JSON.stringify({
      autosize: true,
      symbol: `BINANCE:${symbol}.P`,
      interval,
      timezone: "Asia/Jakarta",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(0, 0, 0, 0)",
      hide_side_toolbar: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    node.appendChild(script);

    return () => {
      node.innerHTML = "";
    };
  }, [symbol, interval]);

  return (
    <div
      ref={host}
      className="tradingview-widget-container overflow-hidden rounded-xl border border-[var(--color-border)]"
      style={{ height }}
    />
  );
}
