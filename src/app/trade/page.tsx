import { Suspense } from "react";

import { LiveFeed } from "@/components/live-feed";
import { LiveTrade } from "@/components/live-trade";
import { OpenOrders } from "@/components/open-orders";
import { ScanFunnel } from "@/components/scan-funnel";
import { SkeletonStatCells, SkeletonTable } from "@/components/skeleton";
import { WatchList } from "@/components/watch-list";
import { Card, Reveal, Stat } from "@/components/ui";
import {
  botFetch,
  type AccountSnapshot,
  type ActivityEvent,
  type Analytics,
  type AiStatus,
  type Limits,
  type WatchEntry,
} from "@/lib/bot-api";
import { TONE_CLASS, money, tone } from "@/lib/format";

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
 * ONLY THE FAST READS ARE AWAITED. Measured 2026-09-23: account 0.4 s and
 * limits 0.3 s, against 1.1 s for today's realised PnL (it walks the day's
 * fills) and 1.3 s for the activity feed. They used to be one `Promise.all`,
 * so the whole page — balance and positions included — waited for the slowest
 * read before anything was sent. The slow halves are now started here, in
 * parallel, and streamed into their own Suspense boundaries.
 */
export default async function TradePage() {
  // `period=day` is MIDNIGHT UTC, not a rolling 24 hours: the boundary the
  // bot's daily loss allowance resets on, so this page's "today" is the bot's.
  const analyticsPromise = botFetch<Analytics>("/api/analytics?period=day");
  const activityPromise = botFetch<{ events: ActivityEvent[] }>("/api/activity?source=engine");
  // Null rather than a thrown page if it is unreachable; the engine tab is
  // the one that must always render.
  const aiPromise = botFetch<AiStatus>("/api/ai").catch(() => null);
  const watchPromise = botFetch<{ watching: WatchEntry[] }>("/api/watch").catch(() => ({
    watching: [] as WatchEntry[],
  }));

  const [account, limits] = await Promise.all([
    botFetch<AccountSnapshot>("/api/account"),
    botFetch<Limits>("/api/limits"),
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
        <div className="space-y-6">
          <LiveTrade
            seed={{ account, limits }}
            realisedSlot={
              <Suspense fallback={<SkeletonStatCells count={1} />}>
                <RealisedToday promise={analyticsPromise} />
              </Suspense>
            }
          />
          {/* Below the positions: the entries still waiting to fill, which is
              the answer to "is the engine doing anything" when no position is
              open yet. */}
          <Reveal delay={0.06}>
            <Card className="p-6" hoverable={false}>
              <OpenOrders />
            </Card>
          </Reveal>
        </div>
        <div className="space-y-6">
          <Reveal delay={0.08}>
            <Card className="p-6" hoverable={false}>
              <Suspense fallback={<SkeletonTable rows={6} />}>
                <Feed activity={activityPromise} ai={aiPromise} />
              </Suspense>
            </Card>
          </Reveal>
          {/* Above the watch list: it answers the question asked most often
              on this page — "why is nothing opening?" — with the rule that
              stopped each pair, instead of leaving it to be read out of log
              lines. */}
          <Reveal delay={0.1}>
            <Card className="p-6" hoverable={false}>
              <ScanFunnel />
            </Card>
          </Reveal>
          <Reveal delay={0.12}>
            <Card className="p-6" hoverable={false}>
              <Suspense fallback={<SkeletonTable rows={3} />}>
                <Watching promise={watchPromise} />
              </Suspense>
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

async function RealisedToday({ promise }: { promise: Promise<Analytics> }) {
  // A failed read shows a dash, not a broken page: this card is the only one
  // on the page that needs the day's fills.
  const analytics = await promise.catch(() => null);
  if (!analytics) {
    return (
      <Stat label="Realized PnL · today" delay={0.1} sub="unavailable">
        —
      </Stat>
    );
  }
  const p = analytics.performance;
  return (
    <Stat
      label="Realized PnL · today"
      delay={0.1}
      sub={`${p.trades} closed`}
      className={TONE_CLASS[tone(p.netPnl)]}
    >
      {money(p.netPnl, { signed: true })}
    </Stat>
  );
}

async function Feed({
  activity,
  ai,
}: {
  activity: Promise<{ events: ActivityEvent[] }>;
  ai: Promise<AiStatus | null>;
}) {
  const [events, aiStatus] = await Promise.all([
    activity.catch(() => ({ events: [] as ActivityEvent[] })),
    ai,
  ]);
  return <LiveFeed initial={events.events} initialAi={aiStatus} />;
}

async function Watching({ promise }: { promise: Promise<{ watching: WatchEntry[] }> }) {
  const watch = await promise;
  return <WatchList initial={watch.watching} />;
}
