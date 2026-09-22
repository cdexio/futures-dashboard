import { NotAuthorised, botFetch, type AiStatus } from "@/lib/bot-api";

/**
 * The validator's state, spend and recent verdicts.
 *
 * Read-only. The switch lives at `/api/ai/toggle`, which is a separate route
 * so that reading this panel and changing it are separate permissions to
 * reason about — and so a GET can never, by any routing accident, flip
 * anything.
 */
export async function GET() {
  try {
    return Response.json(await botFetch<AiStatus>("/api/ai"));
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    return Response.json({ error: "The trading machine did not answer." }, { status: 502 });
  }
}
