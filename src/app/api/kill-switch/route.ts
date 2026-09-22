import { createHash, timingSafeEqual } from "node:crypto";

import { NotAuthorised, requireSession } from "@/lib/bot-api";

/**
 * Engage or release the bot's kill switch.
 *
 * ASYMMETRIC ON PURPOSE. Stopping the bot needs only a signed-in, PIN-verified
 * session: when the account is bleeding, one tap must be enough, and every
 * extra step is money. RESUMING needs the PIN typed again, because turning
 * trading back on is the action that can cost money, and a session left open
 * on a phone should not be able to do it on its own.
 *
 * The kill switch blocks NEW entries only. Open positions keep their stop and
 * take-profit, and the bot keeps managing them — a switch that also froze
 * exits would trap the owner in the positions they were trying to get out of.
 */
const BASE = process.env.BOT_API_URL ?? "http://127.0.0.1:8790";

function pinMatches(pin: unknown): boolean {
  const expected = process.env.DASHBOARD_PIN_SHA256;
  if (!expected) return false; // fail closed, as the PIN route does
  const supplied = createHash("sha256").update(String(pin ?? ""), "utf8").digest();
  const stored = Buffer.from(expected, "hex");
  return stored.length === supplied.length && timingSafeEqual(stored, supplied);
}

export async function POST(request: Request) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    throw error;
  }

  const body = (await request.json().catch(() => ({}))) as { engaged?: boolean; pin?: string };
  if (typeof body.engaged !== "boolean") {
    return Response.json({ error: "engaged must be true or false" }, { status: 400 });
  }
  if (!body.engaged && !pinMatches(body.pin)) {
    return Response.json({ error: "Incorrect PIN — trading stays stopped." }, { status: 401 });
  }

  const response = await fetch(`${BASE}/api/kill-switch`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ engaged: body.engaged }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!response?.ok) {
    return Response.json({ error: "The trading machine did not answer." }, { status: 502 });
  }
  return Response.json(await response.json());
}
