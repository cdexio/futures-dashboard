import { Suspense } from "react";

import { AiModelsPanel } from "@/components/ai-models";
import { LiveFeed } from "@/components/live-feed";
import { LiveTrade } from "@/components/live-trade";
import { OpenOrders } from "@/components/open-orders";
import { ScanFunnel } from "@/components/scan-funnel";
import { SkeletonStatCells, SkeletonTable } from "@/components/skeleton";
import { TradeTabs, type TradeTab } from "@/components/trade-tabs";
import { WatchList } from "@/components/watch-list";
import { WeightMeter } from "@/components/weight-meter";
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
import { TONE_CLASS, money, percent, tone } from "@/lib/format";

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
export default async function TradePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: requested } = await searchParams;
  const tab: TradeTab = requested === "engine" ? "engine" : "positions";

  return (
    <div className="space-y-6">
      <Reveal>
        <h1 className="text-3xl font-semibold tracking-tight">Trade</h1>
        <p className="text-[var(--color-ink-secondary)] mt-2 text-sm">
          {tab === "positions" ? "Positions, today's result and pending orders" : "Scan, AI verdicts and models"}
        </p>
      </Reveal>

      <TradeTabs active={tab} />

      {tab === "positions" ? <PositionsTab /> : <EngineTab />}
    </div>
  );
}

/**
 * TWO TABS, NOT ONE LONG PAGE, and each fetches only its own half. The owner
 * asked for it on 2026-09-23 because checking a position meant scrolling past
 * the feed and back; splitting also halves the reads per page load.
 */
async function PositionsTab() {
  // `period=day` is MIDNIGHT UTC, not a rolling 24 hours. The 7-day read sits
  // beside it because positions are held up to 48 hours: a day is often half
  // of one trade, and the week is what says whether the bot is working.
  const analyticsPromise = botFetch<Analytics>("/api/analytics?period=day").catch(() => null);
  const weekPromise = botFetch<Analytics>("/api/analytics?days=7").catch(() => null);
  const [account, limits] = await Promise.all([
    botFetch<AccountSnapshot>("/api/account"),
    botFetch<Limits>("/api/limits"),
  ]);

  // `min-w-0` everywhere a table lives: a grid or flex item's automatic
  // minimum is its content's min-content width, so the open-orders table
  // (520px, scrollable inside its own box) used to widen the page past a
  // phone's screen. With a zero minimum the table scrolls, the page does not.
  return (
    <div className="min-w-0 space-y-6">
      <LiveTrade
        seed={{ account, limits }}
        realisedSlot={
          <Suspense fallback={<SkeletonStatCells count={2} />}>
            <Realised day={analyticsPromise} week={weekPromise} />
          </Suspense>
        }
      />
      {/* Below the positions: the entries still waiting to fill, which is the
          answer to "is the engine doing anything" when no position is open. */}
      <Reveal delay={0.06}>
        <Card className="p-6" hoverable={false}>
          <OpenOrders />
        </Card>
      </Reveal>
    </div>
  );
}

async function EngineTab() {
  const activityPromise = botFetch<{ events: ActivityEvent[] }>("/api/activity?source=engine");
  // Null rather than a thrown page if it is unreachable; the engine feed is
  // the one that must always render.
  const aiPromise = botFetch<AiStatus>("/api/ai").catch(() => null);
  const watchPromise = botFetch<{ watching: WatchEntry[] }>("/api/watch").catch(() => ({
    watching: [] as WatchEntry[],
  }));

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-6">
        <Reveal delay={0.04}>
          <Card className="p-6" hoverable={false}>
            <Suspense fallback={<SkeletonTable rows={6} />}>
              <Feed activity={activityPromise} ai={aiPromise} />
            </Suspense>
          </Card>
        </Reveal>
        {/* Under the feed, on the owner's request: the verdicts and the ideas
            they shelved read together, top to bottom. */}
        <Reveal delay={0.05}>
          <Card className="p-6" hoverable={false}>
            <Suspense fallback={<SkeletonTable rows={3} />}>
              <Watching promise={watchPromise} />
            </Suspense>
          </Card>
        </Reveal>
      </div>
      <div className="min-w-0 space-y-6">
        <Reveal delay={0.06}>
          <Card className="p-6" hoverable={false}>
            <Suspense fallback={<SkeletonTable rows={4} />}>
              <Models promise={aiPromise} />
            </Suspense>
          </Card>
        </Reveal>
        {/* It answers "why is nothing opening?" with the rule that stopped
            each pair, instead of leaving it to log lines. */}
        <Reveal delay={0.08}>
          <Card className="p-6" hoverable={false}>
            <ScanFunnel />
          </Card>
        </Reveal>
        {/* The IP's Binance allowance, so a coming ban is visible before it
            blinds the bot — added after the 2026-09-25 ban. */}
        <Reveal delay={0.1}>
          <Card className="p-6" hoverable={false}>
            <WeightMeter />
          </Card>
        </Reveal>
      </div>
    </div>
  );
}

async function Models({ promise }: { promise: Promise<AiStatus | null> }) {
  return <AiModelsPanel initial={await promise} />;
}

/** A value that is today's, then the week's, each in its own tone. */
function Pair({
  today,
  week,
  format,
}: {
  today: number | null;
  week: number | null;
  format: (v: number) => string;
}) {
  const part = (v: number | null) =>
    v === null ? <span>—</span> : <span className={TONE_CLASS[tone(v)]}>{format(v)}</span>;
  // Today at full size, the week one step down: two values at 24px did not
  // fit a quarter-width card and wrapped mid-number.
  return (
    <span className="whitespace-nowrap">
      {part(today)}
      <span className="text-base">
        <span className="text-[var(--color-ink-muted)] mx-1.5 font-normal">/</span>
        {part(week)}
      </span>
    </span>
  );
}

/**
 * Realized PnL and realized ROI, today / last 7 days. A failed read shows a
 * dash for that half, never a broken card.
 */
async function Realised({
  day,
  week,
}: {
  day: Promise<Analytics | null>;
  week: Promise<Analytics | null>;
}) {
  const [d, w] = await Promise.all([day, week]);
  const signedMoney = (v: number) => money(v, { signed: true });
  const signedPct = (v: number) => percent(v, { signed: true });
  return (
    <>
      <Stat
        label="Realized PnL · today / 7D"
        delay={0.1}
        sub={`${d?.performance.trades ?? "—"} closed today · ${w?.performance.trades ?? "—"} in 7D`}
      >
        <Pair today={d?.performance.netPnl ?? null} week={w?.performance.netPnl ?? null} format={signedMoney} />
      </Stat>
      <Stat
        label="Realized ROI · today / 7D"
        delay={0.14}
        sub={`on ${d ? money(d.openingEquity) : "—"} · ${w ? money(w.openingEquity) : "—"}`}
      >
        <Pair today={d?.performance.roi ?? null} week={w?.performance.roi ?? null} format={signedPct} />
      </Stat>
    </>
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
