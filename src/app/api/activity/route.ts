import { NotAuthorised, botFetch, type ActivityEvent } from "@/lib/bot-api";

/** The two feeds the Live card shows. Anything else is refused rather than
 *  forwarded: the query goes into a URL on the bot API, and an unvalidated
 *  value there is a hole for free text to travel through. */
const SOURCES = new Set(["engine", "ai"]);

/**
 * The live feed's polling endpoint.
 *
 * It exists so the browser never learns the bot API's address. `botFetch`
 * re-checks both factors on every call, so a session that expired mid-poll
 * stops receiving data at the next tick rather than at the next page load.
 *
 * `?source=` splits engine activity from the validator's. The split is done by
 * the bot API rather than here, so each tab gets its own full page of rows:
 * the position manager speaks every fifteen seconds and the validator a few
 * times an hour, and filtering a shared page in the browser would leave the AI
 * tab empty within a minute of any busy stretch.
 */
export async function GET(request: Request) {
  const asked = new URL(request.url).searchParams.get("source");
  const source = asked && SOURCES.has(asked) ? asked : null;

  try {
    const data = await botFetch<{ events: ActivityEvent[] }>(
      source ? `/api/activity?source=${source}` : "/api/activity",
    );
    return Response.json(data);
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    return Response.json({ events: [] }, { status: 502 });
  }
}
