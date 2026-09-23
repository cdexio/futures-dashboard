import { Card, Reveal, SectionTitle } from "@/components/ui";
import type { RouteStats } from "@/lib/bot-api";
import { TONE_CLASS, money, percent } from "@/lib/format";

/** What each route is for, in one line. The names are the engine's own and
 *  mean nothing to a reader who has not read the source. */
const ABOUT: Record<string, string> = {
  breakout: "buys a new high, sells a new low",
  momentum: "follows strength across timeframes",
  meanrev: "buys the dip inside a quiet regime",
  funding_oi: "fades a crowded book",
  pullback: "buys a retracement inside a trend",
  unattributed:
    "closed before the engine recorded which route opened it — not a route, a gap in the record",
};

/**
 * One card per strategy, because the account only reports their sum.
 *
 * THE REASON THIS EXISTS. Five routes run, one blended number gets reported,
 * and a route that loses steadily every single day is invisible inside a book
 * that is roughly flat. This is the split, and the ONLY question it is meant
 * to answer is which route to stop — so the worst one sorts first rather than
 * the biggest.
 *
 * `unattributed` is shown rather than hidden. Dropping it would make the cards
 * add up to less than the account does, and a reader comparing the two would
 * conclude the routes were mis-measured rather than that some trades predate
 * the record.
 */
export function RouteCards({
  routes,
  days,
}: {
  routes: RouteStats[];
  /** A string when it came straight from the query string, which is where the
   *  page reads it. Only ever displayed, so it is not worth parsing. */
  days: number | string;
}) {
  if (!routes.length) {
    return null;
  }

  return (
    <Reveal delay={0.1}>
      <SectionTitle
        title="By strategy"
        hint={`What each route produced over ${days} days. The account reports their sum, which is where a steadily losing route hides.`}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {routes.map((route) => {
          const up = route.netPnl >= 0;
          return (
            <Card key={route.route} className="p-5" hoverable={false}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-semibold tracking-tight">{route.route}</span>
                <span className="text-[var(--color-ink-muted)] text-[10px]">
                  {route.trades} trade{route.trades === 1 ? "" : "s"}
                </span>
              </div>

              <div
                className={`tabular mt-3 text-2xl leading-none font-semibold ${
                  up ? TONE_CLASS.profit : TONE_CLASS.loss
                }`}
              >
                {money(route.netPnl, { signed: true })}
              </div>

              {/* Wins over total, spelled out. "56%" alone does not say whether
                  it came from nine trades or nine hundred, and at this account's
                  volume that difference is the whole reliability of the number. */}
              <p className="text-[var(--color-ink-secondary)] mt-2 text-xs">
                {route.wins} won / {route.trades} taken
                <span className="text-[var(--color-ink-muted)]">
                  {" "}
                  · {percent(route.winRate)}
                </span>
              </p>

              <p className="text-[var(--color-ink-muted)] mt-1 text-[11px]">
                {money(route.averageTrade, { signed: true })} per trade · {money(route.fees)} fees
              </p>

              <p className="text-[var(--color-ink-muted)] mt-3 text-[10px] leading-relaxed">
                {ABOUT[route.route] ?? "route the engine reported"}
              </p>
              {/* Said on the card, because the number above includes them: a
                  route judged on trades it may never have opened would be
                  judged on attribution, not on its own record. */}
              {!!route.unrecorded && (
                <p className="mt-2 text-[10px] leading-relaxed text-[var(--color-warning)]">
                  includes {route.unrecorded} trade{route.unrecorded === 1 ? "" : "s"} from before
                  routes were recorded
                </p>
              )}
            </Card>
          );
        })}
      </div>
    </Reveal>
  );
}
