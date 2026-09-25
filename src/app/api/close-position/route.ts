import { NotAuthorised, requireSession } from "@/lib/bot-api";
import { pinMatches } from "@/lib/pin";

/**
 * Ask the bot to close one open position now.
 *
 * PIN REQUIRED, like resuming the kill switch: a close cannot be undone — it
 * turns an open result into a realised one — and a session left open on a
 * phone must not be able to do it with a stray tap.
 *
 * The engine API does not place the order. It writes a request the trader's
 * position manager picks up within fifteen seconds, and the close goes out
 * through the same exit path as every stop and time limit: reduce-only market,
 * then the stop and take-profit cancelled.
 */
const BASE = process.env.BOT_API_URL ?? "http://127.0.0.1:8790";

export async function POST(request: Request) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    throw error;
  }

  const body = (await request.json().catch(() => ({}))) as { symbol?: string; pin?: string };
  if (typeof body.symbol !== "string" || !body.symbol) {
    return Response.json({ error: "symbol is required" }, { status: 400 });
  }
  if (!pinMatches(body.pin)) {
    return Response.json({ error: "Incorrect PIN — the position stays open." }, { status: 401 });
  }

  const response = await fetch(`${BASE}/api/close-position`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ symbol: body.symbol }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!response?.ok) {
    return Response.json({ error: "The trading machine did not answer." }, { status: 502 });
  }
  return Response.json(await response.json());
}
