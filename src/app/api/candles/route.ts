import { NotAuthorised, botFetch, type Candle } from "@/lib/bot-api";

/** Intervals the chart offers. Validated here rather than forwarded, because
 *  the value goes into a URL on the bot API and an unchecked one is a hole for
 *  free text to travel through. */
const INTERVALS = new Set(["1h", "2h", "4h", "1d"]); // the lake holds 1h and up since 2026-09-25

/** Letters and digits in any script — the universe holds `龙虾USDT`, which an
 *  A-Z pattern refused, so its detail panel opened with no chart. Nothing
 *  that could break out of a query string passes either way. */
const SYMBOL = /^[\p{L}\p{N}]{2,24}$/u;

/**
 * Candles for one symbol, from the lake the engine itself decided on.
 *
 * Not from Binance: the chart has to show what the BOT saw, and a REST call
 * would also spend the per-IP weight budget the trader needs — on every chart
 * anyone opens.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const symbol = (params.get("symbol") ?? "").toUpperCase();
  const interval = params.get("interval") ?? "4h";
  // Where the window ends, in epoch ms. The history page sends the trade's
  // close so the chart shows the move the trade was IN; anchored to now, a
  // trade from six days ago falls off the right edge entirely. Coerced to a
  // finite integer rather than forwarded, for the same reason `interval` is
  // validated: it ends up in a URL on the bot API.
  const rawEnd = Number(params.get("end"));
  const end = Number.isFinite(rawEnd) && rawEnd > 0 ? Math.floor(rawEnd) : null;

  if (!SYMBOL.test(symbol)) {
    return Response.json({ error: "bad symbol" }, { status: 400 });
  }
  if (!INTERVALS.has(interval)) {
    return Response.json({ error: "bad interval" }, { status: 400 });
  }

  try {
    const data = await botFetch<{ candles: Candle[] }>(
      `/api/candles?symbol=${encodeURIComponent(symbol)}&interval=${interval}${end ? `&end=${end}` : ""}`,
    );
    return Response.json(data);
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    // Empty rather than an error body: the modal renders without a chart, and
    // the rest of what it knows about the trade is still worth showing.
    return Response.json({ symbol, interval, candles: [] }, { status: 502 });
  }
}
