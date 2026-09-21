import { NotAuthorised, botFetch, type AccountSnapshot, type Limits } from "@/lib/bot-api";

/**
 * Everything the Trade page refreshes on its own: balance, positions, limits.
 *
 * ONE ROUTE, NOT TWO. The page polls this every few seconds, and two separate
 * requests would arrive at slightly different instants — so the equity in the
 * header could come from one moment and the position PnL beside it from
 * another, and the two would not add up. A reader who notices that stops
 * trusting the page, correctly. Fetched together, they describe one instant.
 *
 * NOT CACHED anywhere, at either layer. The bot API deliberately leaves the
 * account and limits endpoints out of its aggregate cache: a stale balance is
 * worse than no balance, because it looks authoritative and somebody acts on
 * it. Adding a cache here would reintroduce exactly that.
 *
 * `botFetch` re-checks both auth factors on every call, so a session that
 * expires mid-poll stops receiving data at the next tick rather than at the
 * next page load.
 */
export async function GET() {
  try {
    const [account, limits] = await Promise.all([
      botFetch<AccountSnapshot>("/api/account"),
      botFetch<Limits>("/api/limits"),
    ]);
    return Response.json({ account, limits });
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    return Response.json({ error: "unreachable" }, { status: 502 });
  }
}
