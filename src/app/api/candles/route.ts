import { NotAuthorised, botFetch, type Candle } from "@/lib/bot-api";

/** Intervals the chart offers. Validated here rather than forwarded, because
 *  the value goes into a URL on the bot API and an unchecked one is a hole for
 *  free text to travel through. */
const INTERVALS = new Set(["15m", "30m", "1h", "4h"]);

/** Symbols are uppercase letters and digits. Anything else is not a pair. */
const SYMBOL = /^[A-Z0-9]{2,20}$/;

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
  const interval = params.get("interval") ?? "30m";
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
      `/api/candles?symbol=${symbol}&interval=${interval}${end ? `&end=${end}` : ""}`,
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
