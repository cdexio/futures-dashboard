import { Lock } from "lucide-react";

import { Badge, Card, Reveal, SectionTitle } from "@/components/ui";
import { botFetch, type Settings } from "@/lib/bot-api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Every rule the agent runs under — read-only, by design.
 *
 * Editing from here is deliberately absent rather than disabled. A settings
 * form on a live trading account is a way to change position sizing at three
 * in the morning with no review and no record, and the value that matters
 * most is the one a tired hand is most likely to mistype. Changes go through
 * `.env` and a restart, which leaves a trail.
 */

const LABELS: Record<string, string> = {
  mode: "Execution mode",
  maxEquityUsd: "Equity ceiling (USD)",
  maxPositions: "Concurrent positions",
  minLeverage: "Minimum leverage",
  maxLeverage: "Maximum leverage",
  minMarginUsd: "Minimum margin per position (USD)",
  maxNotionalRatio: "Max position size (× equity)",
  maxMarginRatio: "Max margin per position",
  dailyLossLimit: "Daily loss stop",
  dailyProfitLimit: "Daily profit stop",
  maxDrawdown: "Maximum drawdown",
  killSwitchPath: "Kill switch file",
  riskPerTrade: "Risk per trade",
  maxPortfolioRisk: "Total portfolio risk",
  maxPositionsPerCluster: "Positions per correlation cluster",
  // Every close, not only a losing one — the manager stamps the cooldown on
  // retirement regardless of PnL, and the old label said otherwise.
  reentryCooldownHours: "Re-entry cooldown after any close (hours)",
  stopLimitOffsetPct: "Stop-limit offset",
  takeProfitRMultiple: "Take profit (× risk)",
  trailAtrMultiple: "Trailing stop (× ATR)",
  losingMaxAgeHours: "Max hold — losing (hours)",
  winningMaxAgeHours: "Max hold — winning (hours)",
  allowShorts: "Short trades allowed",
  momentumEnabled: "Momentum strategy",
  pullbackEnabled: "Pullback strategy",
  entryMaxRangePosition: "Max entry position in 24h range",
  entryMaxSignalAgeMinutes: "Entry window after bar close (minutes)",
  stopAtrMultiple: "Stop distance (× ATR)",
  traderUniverseSize: "Symbols screened",
  traderMinQuoteVolume: "Minimum daily turnover (USD)",
  datalakeIntervals: "Candle intervals stored",
  liveFlushAfterSec: "Lake write latency (seconds)",
  datalakeRoot: "Data lake path",
  binanceApiKey: "Binance API key",
  binanceApiSecret: "Binance API secret",
};

/** Fractions that read better as percentages. Everything else is shown as
 *  the exchange or the config states it, because converting a number the
 *  operator will compare against .env only creates a translation step. */
const AS_PERCENT = new Set([
  "dailyLossLimit",
  "dailyProfitLimit",
  "maxDrawdown",
  "riskPerTrade",
  "maxPortfolioRisk",
  "stopLimitOffsetPct",
  "maxMarginRatio",
  "entryMaxRangePosition",
]);

function present(key: string, value: unknown): string {
  // A switch reads as on/off, not as "true". Done before the number branch
  // because `false` is the value an operator most needs to SEE rather than
  // skim past — shorts and momentum being off is most of the current book.
  if (typeof value === "boolean") return value ? "on" : "off";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "number") {
    if (AS_PERCENT.has(key)) return `${(value * 100).toFixed(2)}%`;
    if (key === "traderMinQuoteVolume") return value === 0 ? "none" : `$${value.toLocaleString()}`;
    if (key === "maxEquityUsd") return `$${value.toLocaleString()}`;
    if (key === "maxNotionalRatio") return `${value}× equity`;
    return String(value);
  }
  return String(value);
}

function Group({
  title,
  hint,
  values,
  delay,
}: {
  title: string;
  hint: string;
  values: Record<string, unknown>;
  delay: number;
}) {
  return (
    <Reveal delay={delay}>
      <Card className="p-6" hoverable={false}>
        <SectionTitle title={title} hint={hint} />
        <dl className="divide-y divide-[var(--color-border)]/60">
          {Object.entries(values).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between gap-6 py-3">
              <dt className="text-[var(--color-ink-secondary)] text-sm">{LABELS[key] ?? key}</dt>
              <dd className="tabular text-right text-sm font-medium">{present(key, value)}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </Reveal>
  );
}

export default async function SettingsPage() {
  const settings = await botFetch<Settings>("/api/settings");

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="text-[var(--color-ink-secondary)] mt-2 text-sm">
              Every rule the agent is running under, as it is running it.
            </p>
          </div>
          <span className="glass inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs text-[var(--color-ink-secondary)]">
            <Lock className="h-3.5 w-3.5" /> Read-only
          </span>
        </div>
      </Reveal>

      <Reveal delay={0.03}>
        <div className="rounded-2xl border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/[0.06] p-5">
          <p className="text-sm leading-relaxed text-[var(--color-warning)]">
            Editing is not available here yet, and that is deliberate.
          </p>
          <p className="text-[var(--color-ink-secondary)] mt-2 text-xs leading-relaxed">
            These values decide how much real money each trade risks. A form on a live account is a
            way to change position sizing at three in the morning with no review and no record.
            Changes go through <span className="tabular">.env</span> and a restart, which leaves a
            trail — editing arrives once the agent is settled.
          </p>
        </div>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <Group
          title="Execution"
          hint="What the agent may do, and the ceilings it may not cross."
          values={settings.execution}
          delay={0.04}
        />
        <Group
          title="Risk"
          hint="How much each trade and the whole book may lose."
          values={settings.risk}
          delay={0.08}
        />
        <Group
          title="Signals"
          hint="Which signals may become trades. Measured 2026-09-22: shorts lost on all four strategies, momentum was the worst long route, and refusing entries above 60% of the 24h range was the single largest improvement."
          values={settings.signals}
          delay={0.12}
        />
        <Group
          title="Exits"
          hint="How a position ends: target, trailing stop, or the clock."
          values={settings.exits}
          delay={0.16}
        />
        <Group
          title="Universe"
          hint="Which markets are screened for signals."
          values={settings.universe}
          delay={0.2}
        />
        <Group
          title="Data"
          hint="The lake the signals are built from."
          values={settings.data}
          delay={0.24}
        />
        <Reveal delay={0.28}>
          <Card className="p-6" hoverable={false}>
            <SectionTitle
              title="Credentials"
              hint="Presence only. A settings page that printed a key would put it in a browser cache, a screenshot and a support ticket."
            />
            <dl className="divide-y divide-[var(--color-border)]/60">
              {Object.entries(settings.credentials).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-6 py-3">
                  <dt className="text-[var(--color-ink-secondary)] text-sm">
                    {LABELS[key] ?? key}
                  </dt>
                  <dd>
                    <Badge intent={value === "configured" ? "good" : "bad"}>{value}</Badge>
                  </dd>
                </div>
              ))}
            </dl>
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
