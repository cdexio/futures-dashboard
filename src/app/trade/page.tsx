import { LiveFeed } from "@/components/live-feed";
import { LiveTrade } from "@/components/live-trade";
import { Card, Reveal } from "@/components/ui";
import {
  botFetch,
  type AccountSnapshot,
  type ActivityEvent,
  type Analytics,
  type Limits,
} from "@/lib/bot-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Trade: what is open right now, and what the agent is doing about it.
 *
 * THE SERVER RENDER IS A SEED, NOT THE PAGE. Everything that moves — balance,
 * positions, limits, the activity feed — is handed to a client component that
 * polls and replaces it. Fetching here as well means the first paint is real
 * data instead of a skeleton, which matters on the one page somebody opens
 * specifically to check a number.
 *
 * Today's realised PnL stays server-side: it changes only when a position
 * closes, and the endpoint that computes it walks the whole day's fills. There
 * is no reason to pay for that every four seconds.
 */
export default async function TradePage() {
  const [account, limits, analytics, activity] = await Promise.all([
    botFetch<AccountSnapshot>("/api/account"),
    botFetch<Limits>("/api/limits"),
    // `period=day` is MIDNIGHT UTC, not a rolling 24 hours.
    //
    // This card is labelled "Realized PnL · today" and sits beside one reading
    // "on $94.85 at 00:00 UTC". With `days=1` the two measured different
    // periods: on 2026-09-22 the rolling window reached back to 14:46 the
    // previous day and showed 22 trades at -$2.02, while the UTC day beside it
    // held 8 trades at +$6.14. The owner read the minus sign and asked whether
    // the day's changes had made things worse. They had not; the two cards
    // simply did not mean the same thing by "today".
    //
    // Midnight UTC is also the boundary the bot's daily loss allowance resets
    // on, so this page's "today" is now the bot's own day.
    botFetch<Analytics>("/api/analytics?period=day"),
    botFetch<{ events: ActivityEvent[] }>("/api/activity"),
  ]);

  return (
    <div className="space-y-8">
      <Reveal>
        <h1 className="text-3xl font-semibold tracking-tight">Trade</h1>
        <p className="text-[var(--color-ink-secondary)] mt-2 text-sm">
          Open positions, today&apos;s result, and what the agent is doing right now. This page
          keeps itself current — no refresh needed.
        </p>
      </Reveal>

      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <LiveTrade
          seed={{ account, limits }}
          closedToday={analytics.performance.trades}
          realisedToday={analytics.performance.netPnl}
        />
        <Reveal delay={0.08}>
          <Card className="p-6" hoverable={false}>
            <LiveFeed initial={activity.events} />
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
