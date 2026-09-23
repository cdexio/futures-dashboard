import { NotAuthorised, requireSession } from "@/lib/bot-api";

/**
 * Pick which model a provider runs (DeepSeek chat/reasoner, Claude
 * sonnet/opus/haiku). Same category as the decider switch: it changes who
 * answers, never a size, a limit or an order. The bot checks the name against
 * its own closed list, so this route only checks the shape.
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

  const body = (await request.json().catch(() => ({}))) as {
    provider?: unknown;
    variant?: unknown;
    effort?: unknown;
  };
  let payload: Record<string, string>;
  if (typeof body.effort === "string" && /^[a-z]{2,10}$/.test(body.effort)) {
    payload = { effort: body.effort };
  } else if (
    (body.provider === "deepseek" || body.provider === "claude") &&
    typeof body.variant === "string" &&
    /^[a-z0-9.-]{2,40}$/.test(body.variant)
  ) {
    payload = { provider: body.provider, variant: body.variant };
  } else {
    return Response.json({ error: "provider and variant, or effort, are required" }, { status: 400 });
  }

  const response = await fetch(`${BASE}/api/ai/variant`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!response) {
    return Response.json({ error: "The trading machine did not answer." }, { status: 502 });
  }
  const answer = await response.json().catch(() => ({ error: "Unreadable answer." }));
  return Response.json(answer, { status: response.ok ? 200 : response.status });
}
