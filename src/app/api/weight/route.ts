import { NotAuthorised, botFetch } from "@/lib/bot-api";

/**
 * Binance request weight on the bot's IP, for the Trade page's weight card.
 * The engine answers from Redis, so polling this spends no Binance weight.
 */
export async function GET() {
  try {
    return Response.json(await botFetch("/api/weight"));
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    return Response.json({ error: "unavailable" }, { status: 502 });
  }
}
