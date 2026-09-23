import { NotAuthorised, botFetchRaw } from "@/lib/bot-api";

const KINDS = new Set(["trades", "verdicts"]);

/**
 * CSV download: `/api/export/trades?days=7` or `/api/export/verdicts?days=7`.
 *
 * `trades` — every closed round trip with its route, engine score and the
 * AI's verdict at entry. `verdicts` — every AI verdict, refusals included,
 * with where price went 2/4/8 hours later. Together they answer "is the AI
 * worth it": whether what it refused moved less than what it bought.
 *
 * Validated here rather than forwarded: both values end up in a URL on the
 * bot API.
 */
export async function GET(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  if (!KINDS.has(kind)) {
    return Response.json({ error: "kind must be trades or verdicts" }, { status: 400 });
  }
  const raw = Number(new URL(request.url).searchParams.get("days") ?? 7);
  const days = Number.isFinite(raw) ? Math.min(Math.max(Math.floor(raw), 1), 90) : 7;

  try {
    const upstream = await botFetchRaw(`/api/export/${kind}.csv?days=${days}`);
    if (!upstream.ok) {
      return Response.json({ error: `export failed (${upstream.status})` }, { status: 502 });
    }
    return new Response(await upstream.text(), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          upstream.headers.get("Content-Disposition") ??
          `attachment; filename="cdexio-${kind}-${days}d.csv"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    return Response.json({ error: "export unavailable" }, { status: 502 });
  }
}
