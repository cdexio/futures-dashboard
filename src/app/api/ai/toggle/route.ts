import { NotAuthorised, requireSession } from "@/lib/bot-api";

/**
 * Switch the AI validator on or off.
 *
 * NO PIN, AND THE ASYMMETRY IS DELIBERATE — the opposite way round from the
 * kill switch. That one guards RESUMING, because turning trading back on is
 * the action that can cost money. This one guards nothing extra because
 * neither direction can: switching the validator off stops the bot asking a
 * model for a second opinion, and switching it on starts it asking again.
 * Neither places, cancels or modifies an order, and neither changes a limit,
 * a size or a rule.
 *
 * What it CAN do is spend a few cents a day, which the bot's own daily ceiling
 * already bounds.
 *
 * A signed-in, PIN-verified session is still required — `requireSession`
 * checks both factors — because nothing on this dashboard should be reachable
 * without one.
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

  const body = (await request.json().catch(() => ({}))) as { enabled?: boolean };
  if (typeof body.enabled !== "boolean") {
    return Response.json({ error: "enabled must be true or false" }, { status: 400 });
  }

  const response = await fetch(`${BASE}/api/ai/toggle`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ enabled: body.enabled }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!response?.ok) {
    // Reported, never swallowed. An operator who believes they turned
    // something off, and did not, is worse off than one who sees an error.
    return Response.json({ error: "The trading machine did not answer." }, { status: 502 });
  }
  return Response.json(await response.json());
}
