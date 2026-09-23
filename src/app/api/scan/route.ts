import { NotAuthorised, botFetch, type ScanHistoryRow, type ScanSummary } from "@/lib/bot-api";

/**
 * The scan card's polling endpoint: what the last cycle saw at every stage.
 *
 * Empty on failure rather than an error — the card says "no scan recorded
 * yet", and the rest of the Trade page keeps rendering.
 */
export async function GET() {
  try {
    const data = await botFetch<{ last: ScanSummary | null; history: ScanHistoryRow[] }>(
      "/api/scan",
    );
    return Response.json(data);
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    return Response.json({ last: null, history: [] }, { status: 502 });
  }
}
