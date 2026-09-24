import { Lock } from "lucide-react";

import { AiModelsPanel } from "@/components/ai-models";
import { AiPanel } from "@/components/ai-panel";
import { DevicesPanel } from "@/components/devices-panel";
import { Card, Reveal, SectionTitle } from "@/components/ui";
import { botFetch, type AiStatus, type Settings } from "@/lib/bot-api";

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
  entryPostOnly: "Enter with resting limit orders (maker)",
  maxNotionalRatio: "Max position size (× equity)",
  maxMarginRatio: "Max margin per position",
  limitPeriod: "Loss limit period",
  dailyLossLimit: "Loss stop per period",
  dailyProfitLimit: "Profit stop per period",
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
  takeProfitRoiOnMargin: "Take profit — target return on margin",
  takeProfitMinR: "Take profit — floor (× risk)",
  trailAtrMultiple: "Trailing stop (× ATR)",
  losingMaxAgeHours: "Max hold — losing, fallback (hours)",
  winningMaxAgeHours: "Max hold — winning, fallback (hours)",
  holdMinHours: "Hold for the weakest signal (hours)",
  holdMaxHours: "Hold for the strongest signal (hours)",
  allowShorts: "Short trades allowed",
  momentumEnabled: "Momentum strategy",
  pullbackEnabled: "Pullback strategy",
  shortRequiresMarketDowntrend: "Shorts require a falling market",
  entryMaxRangePosition: "Max entry position in 24h range",
  entryMaxRangePositionByStrategy: "Per-strategy entry position ceiling",
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
  if (key === "limitPeriod") return value === "week" ? "Weekly · from Monday 00:00 UTC" : "Daily · 00:00 UTC";
  if (key === "dailyProfitLimit" && value === 0) return "off";
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
  const [settings, ai] = await Promise.all([
    botFetch<Settings>("/api/settings"),
    // Null rather than a thrown page. The validator's panel is the one part
    // of this page that talks to a second service, and a settings page that
    // 500s because a side panel is unreachable is worse than one that shows
    // the rules and says the panel is unavailable.
    botFetch<AiStatus>("/api/ai").catch(() => null),
  ]);

  return (
    <div className="space-y-8">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="text-[var(--color-ink-secondary)] mt-2 text-sm">
              Active configuration · edit via .env
            </p>
          </div>
          <span className="glass inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs text-[var(--color-ink-secondary)]">
            <Lock className="h-3.5 w-3.5" /> Read-only
          </span>
        </div>
      </Reveal>

      {/* One card for every AI control: the on/off switch, then the provider
          and model. The Trade page shows the same model panel without the
          controls. */}
      <Reveal delay={0.035}>
        <Card className="p-6" hoverable={false}>
          <SectionTitle title="AI Agent" hint="Validation, provider and model" />
          <div className="space-y-5">
            <AiPanel initial={ai} />
            <div className="border-[var(--color-border)] border-t pt-5">
              <AiModelsPanel initial={ai} controls />
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={0.036}>
        <Card className="p-6" hoverable={false}>
          <SectionTitle title="Devices" hint="Approved browsers" />
          <DevicesPanel />
        </Card>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <Group
          title="Execution"
          hint="Mode and ceilings"
          values={settings.execution}
          delay={0.04}
        />
        <Group
          title="Risk"
          hint="Per trade and portfolio"
          values={settings.risk}
          delay={0.08}
        />
        <Group
          title="Signals"
          hint="Allowed strategies and filters"
          values={settings.signals}
          delay={0.12}
        />
        <Group
          title="Exits"
          hint="Target, trailing stop, time limit"
          values={settings.exits}
          delay={0.16}
        />
        <Group
          title="Universe"
          hint="Screened markets"
          values={settings.universe}
          delay={0.2}
        />
        <Group
          title="Data"
          hint="Candle data"
          values={settings.data}
          delay={0.24}
        />
      </div>
    </div>
  );
}
