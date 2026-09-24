"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { OctagonX, ShieldAlert, ShieldCheck } from "lucide-react";

import { KillSwitch } from "@/components/kill-switch";
import { PositionDetail } from "@/components/position-detail";
import { Badge, Card, EmptyState, Gauge, LiveDot, Reveal, SectionTitle, Stat } from "@/components/ui";
import type { LiveSnapshot, Position } from "@/lib/bot-api";
import { useLive } from "@/lib/use-live";
import { TONE_CLASS, duration, money, percent, price, quantity, tone, utcTime } from "@/lib/format";

/**
 * The Trade page's live half: balance, limits and open positions, refreshing
 * themselves.
 *
 * SEEDED BY THE SERVER RENDER, so the first paint is real data rather than a
 * skeleton. Everything below re-renders from the poll; nothing on this page
 * requires the reader to refresh, which is what it is for.
 *
 * The numbers are laid out so the two questions a reader actually has are
 * answered before they scroll: "am I up or down", and "what happens if this
 * goes wrong". The second is the protection block on every position card —
 * where the stop is, how far away it is, and whether one exists at all.
 */
export function LiveTrade({
  seed,
  realisedSlot,
}: {
  seed: LiveSnapshot;
  /** Today's realised PnL, rendered by the SERVER and streamed in. It is a
   *  slot rather than two numbers because computing it walks the day's fills
   *  — about a second — and taking it as props made the balance, the
   *  positions and every other card on the page wait for that second. */
  realisedSlot: React.ReactNode;
}) {
  const { data, stale, at } = useLive<LiveSnapshot>("/api/live", seed, 4000);
  const { account, limits } = data;
  // Which position's detail panel is open. Held here rather than inside the
  // card so the modal is a sibling of the grid: nested inside a card it would
  // inherit that card's stacking context and the backdrop would cover only
  // the card it came from.
  const [detail, setDetail] = useState<Position | null>(null);

  const dayRoi = limits.dayStartEquity
    ? (limits.currentEquity - limits.dayStartEquity) / limits.dayStartEquity
    : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="text-[var(--color-ink-muted)] text-xs">
            Updated {utcTime(new Date(at).toISOString())} UTC
          </div>
          {stale ? (
            <span className="text-xs text-[var(--color-warning)]">Reconnecting…</span>
          ) : (
            <LiveDot label="Live" />
          )}
        </div>
        <KillSwitch engaged={limits.killSwitch} />
      </div>

      {(limits.tradingHalted || limits.killSwitch) && <HaltBanner limits={limits} />}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Equity"
          delay={0.02}
          sub={`${money(account.available)} free · ${money(account.marginUsed)} in margin`}
        >
          {money(account.equity)}
        </Stat>
        <Stat
          label="Unrealized PnL"
          delay={0.06}
          sub={`${account.openPositions} of ${account.maxPositions} slots used`}
          className={TONE_CLASS[tone(account.unrealizedPnl)]}
        >
          {money(account.unrealizedPnl, { signed: true })}
        </Stat>
        {realisedSlot}
        <Stat
          label="ROI · today"
          delay={0.14}
          sub={`on ${money(limits.dayStartEquity)} at 00:00 UTC`}
          className={TONE_CLASS[tone(dayRoi)]}
        >
          {percent(dayRoi, { signed: true })}
        </Stat>
      </div>

      <Reveal delay={0.04}>
        <Card className="p-6">
          <SectionTitle title="Safety limits" hint="Any one stops new entries · resets 00:00 UTC" />
          <div className="grid gap-6 md:grid-cols-3">
            <Gauge
              used={limits.profitUsed}
              limit={limits.profitLimit}
              intent="good"
              label={`Profit target · from ${money(limits.dayStartEquity)}`}
            />
            <Gauge
              used={limits.lossUsed}
              limit={limits.lossLimit}
              intent="bad"
              label={`Daily loss · from ${money(limits.dayStartEquity)}`}
            />
            <Gauge
              used={limits.drawdown}
              limit={limits.drawdownLimit}
              intent="bad"
              label={`Drawdown · from peak ${money(limits.peakEquity)}`}
            />
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.06}>
        <Card className="p-6" hoverable={false}>
          <SectionTitle title={`Open positions · ${account.positions.length}`} />
          {account.positions.length ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {account.positions.map((position) => (
                <PositionCard
                  key={position.symbol}
                  position={position}
                  onOpen={() => setDetail(position)}
                />
              ))}
            </div>
          ) : (
            <EmptyState title="No open positions" />
          )}
          <p className="text-[var(--color-ink-muted)] mt-4 text-[11px]">
            Exchange timestamp {utcTime(account.asOf)} UTC
          </p>
        </Card>
      </Reveal>

      <PositionDetail
        target={
          detail && {
            symbol: detail.symbol,
            side: detail.side,
            entryPrice: detail.entryPrice,
            markPrice: detail.markPrice,
            stopPrice: detail.stopPrice,
            takeProfitPrice: detail.takeProfitPrice,
            strategy: detail.strategy,
            score: detail.score,
            maxHoldHours: detail.maxHoldHours,
            holdRemainingHours: detail.holdRemainingHours,
            leverage: detail.leverage,
            openedAt: detail.openedAt,
            unrealizedPnl: detail.unrealizedPnl,
            notional: detail.notional,
            quantity: detail.quantity,
            marginUsd: detail.marginUsd,
            roi: detail.roi,
            priceChange: detail.priceChange,
            liquidationPrice: detail.liquidationPrice,
            liquidationDistance: detail.liquidationDistance,
            protected: detail.protected,
            ageMinutes: detail.ageMinutes,
          }
        }
        onClose={() => setDetail(null)}
      />
    </div>
  );
}

function HaltBanner({ limits }: { limits: LiveSnapshot["limits"] }) {
  const reason = limits.killSwitch
    ? "Kill switch on. Open positions are still managed."
    : {
        drawdown: `Drawdown ${percent(limits.drawdown)} from peak ${money(limits.peakEquity)} · limit ${percent(limits.drawdownLimit)}`,
        daily_loss: `Daily loss ${percent(limits.lossUsed)} · limit ${percent(limits.lossLimit)}`,
        daily_profit: `Daily target reached · ${percent(limits.profitUsed)}`,
      }[limits.haltReason ?? "daily_loss"];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 rounded-2xl border border-[var(--color-warning)]/40 bg-[var(--color-warning)]/8 p-4"
    >
      <OctagonX className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-warning)]" />
      <div>
        <p className="text-sm font-semibold text-[var(--color-warning)]">
          New entries are stopped
        </p>
        <p className="text-[var(--color-ink-secondary)] mt-1 text-xs leading-relaxed">{reason}</p>
      </div>
    </motion.div>
  );
}

function PositionCard({
  position,
  onOpen,
}: {
  position: Position;
  onOpen?: (position: Position) => void;
}) {
  const up = position.unrealizedPnl >= 0;

  return (
    <div
      role={onOpen ? "button" : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={() => onOpen?.(position)}
      onKeyDown={(e) => {
        if (onOpen && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onOpen(position);
        }
      }}
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-raised)]/60 p-4 transition-colors hover:border-[var(--color-border-strong)] ${
        onOpen ? "cursor-pointer" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold tracking-tight">{position.symbol}</span>
          <Badge intent={position.side === "long" ? "long" : "short"}>{position.side}</Badge>
          {position.leverage && <Badge>{position.leverage}x</Badge>}
          {/* WHICH IDEA OPENED THIS. Not on the exchange — Binance knows a
              position, not the route that produced it — so it comes from the
              engine's own record and is absent for anything opened before
              that record existed. */}
          {position.strategy && <Badge intent="neutral">{position.strategy}</Badge>}
          {position.holdRemainingHours !== null &&
            position.holdRemainingHours !== undefined && (
              <span
                className={`text-[10px] ${
                  position.holdRemainingHours <= 0.5
                    ? "text-[var(--color-warning)]"
                    : "text-[var(--color-ink-muted)]"
                }`}
              >
                {position.holdRemainingHours <= 0
                  ? "time limit passed"
                  : `${position.holdRemainingHours.toFixed(1)}h of ${position.maxHoldHours?.toFixed(0)}h left`}
              </span>
            )}
          {position.protected ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-mint)]">
              <ShieldCheck className="h-3 w-3" /> protected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-[var(--color-loss)]">
              <ShieldAlert className="h-3 w-3" /> no stop
            </span>
          )}
        </div>
        <div className="text-right">
          <div
            className={`tabular text-lg leading-none font-semibold ${up ? TONE_CLASS.profit : TONE_CLASS.loss}`}
          >
            {money(position.unrealizedPnl, { signed: true })}
          </div>
          <div className={`tabular mt-1 text-xs ${up ? TONE_CLASS.profit : TONE_CLASS.loss}`}>
            {percent(position.roi, { signed: true })} on margin
          </div>
        </div>
      </div>

      <div className="text-[var(--color-ink-muted)] mt-4 grid grid-cols-2 gap-x-5 gap-y-2.5 text-xs sm:grid-cols-3">
        <Field label="Margin" value={money(position.marginUsd)} />
        <Field label="Size" value={`${quantity(position.quantity)}`} />
        <Field label="Notional" value={money(position.markNotional)} />
        <Field label="Entry" value={price(position.entryPrice)} />
        <Field label="Mark" value={price(position.markPrice)} />
        <Field
          label="Price move"
          value={percent(position.priceChange, { signed: true })}
          tone={position.priceChange >= 0 ? "profit" : "loss"}
        />
        <Field
          label="Stop"
          value={position.stopPrice ? price(position.stopPrice) : "none"}
          note={position.stopDistance != null ? `${percent(position.stopDistance)} away` : undefined}
          tone={position.stopPrice ? "loss" : undefined}
        />
        <Field
          label="Take profit"
          value={position.takeProfitPrice ? price(position.takeProfitPrice) : "none"}
          note={
            position.takeProfitDistance != null
              ? `${percent(position.takeProfitDistance)} away`
              : undefined
          }
          tone={position.takeProfitPrice ? "profit" : undefined}
        />
        <Field
          label="Held"
          value={position.ageMinutes != null ? duration(position.ageMinutes) : "—"}
        />
      </div>

      {/* Cross margin reports no per-position liquidation level, because
          liquidation is an account-level event there. Saying so beats printing
          a zero that reads as "liquidation at price zero". */}
      <p className="text-[var(--color-ink-muted)] mt-3 text-[10px]">
        {position.liquidationPrice
          ? `Liquidation ${price(position.liquidationPrice)}${
              position.liquidationDistance != null
                ? ` · ${percent(position.liquidationDistance)} away`
                : ""
            }`
          : "Cross margin · liquidation on account level"}
      </p>
    </div>
  );
}

function Field({
  label,
  value,
  note,
  tone: t,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: "profit" | "loss";
}) {
  return (
    <div>
      <div className="text-[10px] tracking-wide uppercase">{label}</div>
      <div
        className={`tabular mt-1 text-sm ${t ? TONE_CLASS[t] : "text-[var(--color-ink-secondary)]"}`}
      >
        {value}
      </div>
      {note && <div className="text-[var(--color-ink-muted)] mt-0.5 text-[10px]">{note}</div>}
    </div>
  );
}
