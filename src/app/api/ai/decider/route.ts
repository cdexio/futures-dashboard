import { NotAuthorised, requireSession } from "@/lib/bot-api";

/**
 * Choose which AI model decides, and whether it switches by itself.
 *
 * Same category as the validator toggle: it changes whose verdict is acted
 * on, never a size, a limit or an order, so a signed-in session is enough.
 * Takes effect on the next cycle.
 */
const BASE = process.env.BOT_API_URL ?? "http://127.0.0.1:8790";

const MODELS = ["deepseek", "claude"];
const MODES = ["manual", "auto"];

export async function POST(request: Request) {
  try {
    await requireSession();
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    throw error;
  }

  const body = (await request.json().catch(() => ({}))) as { decider?: string; mode?: string };
  const payload: { decider?: string; mode?: string } = {};
  if (body.decider !== undefined) {
    if (!MODELS.includes(body.decider)) {
      return Response.json({ error: "decider must be deepseek or claude" }, { status: 400 });
    }
    payload.decider = body.decider;
  }
  if (body.mode !== undefined) {
    if (!MODES.includes(body.mode)) {
      return Response.json({ error: "mode must be manual or auto" }, { status: 400 });
    }
    payload.mode = body.mode;
  }
  if (!payload.decider && !payload.mode) {
    return Response.json({ error: "nothing to set" }, { status: 400 });
  }

  const response = await fetch(`${BASE}/api/ai/decider`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null);

  if (!response?.ok) {
    return Response.json({ error: "The trading machine did not answer." }, { status: 502 });
  }
  return Response.json(await response.json());
}
