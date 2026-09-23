"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Bot, Loader2 } from "lucide-react";

import { Badge } from "@/components/ui";
import type { AiModel, AiModelState, AiModels, AiStatus } from "@/lib/bot-api";
import { relative } from "@/lib/format";

const LABEL: Record<AiModel, string> = { deepseek: "DeepSeek", claude: "Claude" };

const WIB_TIME = new Intl.DateTimeFormat("id-ID", {
  timeZone: "Asia/Jakarta",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

function resetsIn(epochSec: number | undefined): string | null {
  if (!epochSec) return null;
  const ms = epochSec * 1000 - Date.now();
  const at = WIB_TIME.format(new Date(epochSec * 1000)).replace(".", ":");
  if (ms <= 0) return `reset ${at} WIB`;
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `resets in ${h > 0 ? `${h}h ` : ""}${m}m · ${at} WIB`;
}

/**
 * Why a model counts as out of limit — the same rules the trader's selector
 * applies (`engine/ai/selector.py`), so what this panel calls "spent" is what
 * the auto switch would act on. Null when it has room left.
 */
function exhausted(model: AiModel, state: AiModelState | null | undefined, t: AiModels["thresholds"]) {
  if (!state) return null;
  if (state.auth_failed) return "credential refused";
  const l = state.limits ?? {};
  const error = state.last_error ?? "";
  if (model === "deepseek") {
    if (l.available === false) return "account unavailable";
    if (l.balance_usd !== undefined && l.balance_usd < t.deepseekMinBalanceUsd)
      return `balance under $${t.deepseekMinBalanceUsd.toFixed(2)}`;
    if (state.over_budget) return "daily budget spent";
    if (error.includes("402")) return "no balance (402)";
    return null;
  }
  if (l.status && l.status !== "allowed" && l.status !== "allowed_warning") return `limit ${l.status}`;
  if ((l.five_hour ?? 0) >= t.claudeMaxFiveHour) return "5-hour window nearly spent";
  if ((l.seven_day ?? 0) >= t.claudeMaxSevenDay) return "weekly window nearly spent";
  if (/\b(429|usage limit|rate limit|limit reached)\b/i.test(error)) return "usage limit hit";
  return null;
}

function Bar({ share, max }: { share: number; max: number }) {
  const pct = Math.min(100, share * 100);
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
      <div
        className="h-full rounded-full transition-[width] duration-700"
        style={{
          width: `${pct}%`,
          background:
            share >= max
              ? "var(--color-loss)"
              : share >= max * 0.8
                ? "var(--color-warning)"
                : "var(--color-solana-bright)",
        }}
      />
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  disabled,
  label,
}: {
  value: T;
  options: { id: T; label: string; disabled?: boolean }[];
  onChange: (next: T) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-[var(--color-surface-overlay)] p-0.5">
      {options.map((option) => {
        const selected = option.id === value;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled || option.disabled}
            onClick={() => !selected && onChange(option.id)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40 ${
              selected
                ? "bg-[var(--color-surface)] text-[var(--color-ink)] shadow-sm"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink-secondary)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function ModelCard({
  model,
  models,
}: {
  model: AiModel;
  models: AiModels;
}) {
  const state = models.limits[model];
  const deciding = models.decider === model;
  const spent = exhausted(model, state, models.thresholds);
  const l = state?.limits ?? null;
  const off = model === "claude" && !models.claudeEnabled;

  return (
    <div
      className={`rounded-xl border p-4 ${
        deciding
          ? "border-[var(--color-solana-dim)] bg-[var(--color-solana)]/[0.06]"
          : "border-[var(--color-border)]"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">{LABEL[model]}</span>
        {deciding ? (
          <Badge intent="good">deciding</Badge>
        ) : off ? (
          <Badge>off</Badge>
        ) : models.compareBoth ? (
          <Badge>comparing</Badge>
        ) : (
          <Badge>idle</Badge>
        )}
        {spent && <Badge intent="bad">{spent}</Badge>}
        {state && !state.last_call_ok && !spent && state.last_error && (
          <Badge intent="warn">last call failed</Badge>
        )}
      </div>
      {state?.model && (
        <p className="text-[var(--color-ink-muted)] mt-1 text-[11px]">{state.model}</p>
      )}

      <div className="mt-3 space-y-3 text-xs">
        {!state || !l ? (
          <p className="text-[var(--color-ink-muted)] text-[11px]">
            {off
              ? "Disabled in .env (AI_CLAUDE_ENABLED)."
              : "No limit reading yet — it is taken on the first cycle after a restart."}
          </p>
        ) : model === "deepseek" ? (
          <div>
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-[var(--color-ink-secondary)]">Balance left</span>
              <span className="tabular font-medium">${(l.balance_usd ?? 0).toFixed(2)}</span>
            </div>
            <p className="text-[var(--color-ink-muted)] mt-1 text-[10px]">
              Switches away below ${models.thresholds.deepseekMinBalanceUsd.toFixed(2)} · ${" "}
              {state.usd_today.toFixed(4)} spent today over {state.calls_today} calls
            </p>
          </div>
        ) : (
          <>
            {(
              [
                ["5-hour window", l.five_hour, l.five_hour_resets_at, models.thresholds.claudeMaxFiveHour],
                ["Weekly window", l.seven_day, l.seven_day_resets_at, models.thresholds.claudeMaxSevenDay],
              ] as const
            ).map(([label, share, reset, max]) => (
              <div key={label}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="text-[var(--color-ink-secondary)]">{label}</span>
                  <span className="tabular font-medium">
                    {share === undefined ? "—" : `${Math.round(share * 100)}% used`}
                  </span>
                </div>
                <Bar share={share ?? 0} max={max} />
                <p className="text-[var(--color-ink-muted)] mt-1 text-[10px]">
                  switches away at {Math.round(max * 100)}%
                  {resetsIn(reset) ? ` · ${resetsIn(reset)}` : ""}
                </p>
              </div>
            ))}
            <p className="text-[var(--color-ink-muted)] text-[10px]">
              Max subscription, no per-call cost · {state.calls_today} calls today
            </p>
          </>
        )}
        {state?.last_error && !state.last_call_ok && (
          <p className="text-[var(--color-warning)] text-[10px] break-words">
            {state.last_error.slice(0, 160)}
          </p>
        )}
        {state?.at && (
          <p className="text-[var(--color-ink-muted)] text-[10px]">read {relative(state.at)}</p>
        )}
      </div>
    </div>
  );
}

function pct(v: number | null | undefined) {
  return v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function Compare({ models }: { models: AiModels }) {
  const { compare } = models;
  if (!compare.sharedCandidates) {
    return (
      <p className="text-[var(--color-ink-muted)] text-[11px] leading-relaxed">
        No candidate answered by both models yet. The comparison fills in once both have
        answered the same bars — same market, same minute, the only fair test.
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <p className="text-[var(--color-ink-secondary)] text-[11px]">
        {compare.sharedCandidates} candidates answered by both, last 7 days · agreed on{" "}
        <span className="font-medium text-[var(--color-ink)]">
          {compare.agreement === null || compare.agreement === undefined
            ? "—"
            : `${Math.round(compare.agreement * 100)}%`}
        </span>
      </p>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-[11px]">
          <thead>
            <tr className="text-[var(--color-ink-muted)] text-left">
              <th className="py-1 font-normal">Model</th>
              <th className="py-1 font-normal">buy / skip / watch</th>
              <th className="py-1 font-normal">buys after 4h</th>
              <th className="py-1 font-normal">skips after 4h</th>
            </tr>
          </thead>
          <tbody>
            {(["deepseek", "claude"] as const).map((model) => {
              const row = compare.models[model];
              if (!row) return null;
              const better =
                row.buyMean4h !== null && row.skipMean4h !== null
                  ? row.buyMean4h > row.skipMean4h
                  : null;
              return (
                <tr key={model} className="border-[var(--color-border)] border-t">
                  <td className="py-1.5 font-medium">{LABEL[model]}</td>
                  <td className="tabular py-1.5">
                    {row.counts.buy ?? 0} / {row.counts.skip ?? 0} / {row.counts.watch ?? 0}
                  </td>
                  <td
                    className={`tabular py-1.5 ${
                      better === null
                        ? ""
                        : better
                          ? "text-[var(--color-profit)]"
                          : "text-[var(--color-loss)]"
                    }`}
                  >
                    {pct(row.buyMean4h)}
                    <span className="text-[var(--color-ink-muted)]"> ({row.buyMeasured})</span>
                  </td>
                  <td className="tabular py-1.5">{pct(row.skipMean4h)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[var(--color-ink-muted)] text-[10px] leading-relaxed">
        Average price move in the trade&apos;s direction 4 hours after the verdict, before fees.
        A model earns its keep when its buys move further than its skips — green means they did.
        The number in brackets is how many buys have a finished 4-hour window.
      </p>
    </div>
  );
}

/**
 * Which model decides, whether it switches by itself, and what each has left.
 *
 * BOTH MODELS ANSWER EVERY BAR; ONE IS ACTED ON. That is what makes the
 * comparison fair — a schedule that gave each model its own hours would be
 * comparing the market at those hours, not the models.
 *
 * AUTO LOOKS ONLY AT THE MODEL IN USE. It switches when that one runs out —
 * DeepSeek's balance, Claude's 5-hour or weekly window — and only to a model
 * that has room left. Manual never switches.
 *
 * THE STATE SHOWN IS THE SERVER'S, never an optimistic flip.
 */
export function AiModelsPanel({ initial }: { initial: AiStatus | null }) {
  const [models, setModels] = useState<AiModels | undefined>(initial?.models);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch("/api/ai", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as AiStatus;
        if (alive && body.models) setModels(body.models);
      } catch {
        /* keep the last known state */
      }
    };
    if (!initial?.models) void tick();
    const timer = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [initial?.models]);

  async function set(change: { decider?: AiModel; mode?: "manual" | "auto" }) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/decider", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(change),
      });
      const body = (await response.json()) as {
        decider?: AiModel;
        mode?: "manual" | "auto";
        error?: string;
      };
      if (!response.ok || !body.decider || !body.mode) {
        setError(body.error ?? "The trading machine did not answer.");
        return;
      }
      const { decider, mode } = body;
      setModels((current) => (current ? { ...current, decider, mode } : current));
    } catch {
      setError("The trading machine did not answer.");
    } finally {
      setBusy(false);
    }
  }

  if (!models) {
    return (
      <p className="text-[var(--color-ink-muted)] text-sm">
        The model switch is unavailable — the API is older than the two-model validator, or not
        reachable.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-[var(--color-solana-bright)]" />
          <span className="text-sm font-medium">Deciding model</span>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            label="Deciding model"
            value={models.decider}
            disabled={busy}
            onChange={(decider) => set({ decider })}
            options={[
              { id: "deepseek", label: "DeepSeek" },
              { id: "claude", label: "Claude", disabled: !models.claudeEnabled },
            ]}
          />
          <Segmented
            label="Switch mode"
            value={models.mode}
            disabled={busy}
            onChange={(mode) => set({ mode })}
            options={[
              { id: "manual", label: "Manual" },
              { id: "auto", label: "Auto" },
            ]}
          />
        </div>
      </div>

      <p className="text-[var(--color-ink-muted)] text-[11px] leading-relaxed">
        {models.mode === "auto"
          ? `Auto: stays on ${LABEL[models.decider]} until its own limit runs out, then moves to the other model if that one has room. If both are spent it stays put.`
          : `Manual: ${LABEL[models.decider]} decides until you change it here, whatever its limit says.`}{" "}
        {models.compareBoth
          ? "The other model answers the same candidates in the background, for comparison only."
          : ""}{" "}
        Changes apply from the next cycle.
      </p>

      {error && <p className="text-[var(--color-loss)] text-xs">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <ModelCard model="deepseek" models={models} />
        <ModelCard model="claude" models={models} />
      </div>

      <div className="border-[var(--color-border)] border-t pt-4">
        <p className="mb-2 text-sm font-medium">Claude vs DeepSeek</p>
        <Compare models={models} />
      </div>

      {models.switches.length > 0 && (
        <div className="border-[var(--color-border)] border-t pt-4">
          <p className="mb-2 text-sm font-medium">Recent switches</p>
          <ul className="space-y-1.5">
            {models.switches.slice(0, 5).map((s) => (
              <li key={s.at} className="text-[11px] leading-relaxed">
                <span className="inline-flex items-center gap-1 font-medium">
                  {LABEL[s.from] ?? s.from} <ArrowRight className="h-3 w-3" /> {LABEL[s.to] ?? s.to}
                </span>
                <span className="text-[var(--color-ink-secondary)]"> — {s.reason}</span>
                <span className="text-[var(--color-ink-muted)]"> · {relative(s.at)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
