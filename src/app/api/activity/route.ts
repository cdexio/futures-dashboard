import { NotAuthorised, botFetch, type ActivityEvent } from "@/lib/bot-api";

/**
 * The live feed's polling endpoint.
 *
 * It exists so the browser never learns the bot API's address. `botFetch`
 * re-checks both factors on every call, so a session that expired mid-poll
 * stops receiving data at the next tick rather than at the next page load.
 */
export async function GET() {
  try {
    const data = await botFetch<{ events: ActivityEvent[] }>("/api/activity");
    return Response.json(data);
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    return Response.json({ events: [] }, { status: 502 });
  }
}
