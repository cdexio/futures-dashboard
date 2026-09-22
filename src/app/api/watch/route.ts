import { NotAuthorised, botFetch, type WatchEntry } from "@/lib/bot-api";

/**
 * The watch list's polling endpoint.
 *
 * Empty on failure rather than an error, because an unreachable watch list is
 * not something the owner can act on and not something that changes what the
 * bot is doing. The card's own "Unreachable" label carries the news; a 502
 * body full of nothing keeps the page rendering.
 */
export async function GET() {
  try {
    const data = await botFetch<{ watching: WatchEntry[] }>("/api/watch");
    return Response.json(data);
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    return Response.json({ watching: [] }, { status: 502 });
  }
}
