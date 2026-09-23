import { NotAuthorised, botFetch, type OpenOrder } from "@/lib/bot-api";

/**
 * The open-orders card's polling endpoint. Empty on failure, so an unreachable
 * exchange shows "Unreachable" on the card rather than breaking the page.
 */
export async function GET() {
  try {
    const data = await botFetch<{ orders: OpenOrder[]; asOf: string }>("/api/orders");
    return Response.json(data);
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    return Response.json({ orders: [], asOf: null }, { status: 502 });
  }
}
