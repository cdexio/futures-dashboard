"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Eye, Loader2, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui";
import type { AiStatus } from "@/lib/bot-api";

function money(usd: number): string {
  // Four decimals because the numbers are cents. Rounded to two, a day that
  // cost $0.0003 reads as $0.00 — free — and the running total then appears to
  // come from nowhere.
  return `$${usd.toFixed(4)}`;
}

/**
 * The validator: on or off, what it has spent, and what it has been saying.
 *
 * THE SWITCH IS OPERATIONAL, NOT A SETTING, and that distinction is why it is
 * allowed on a page that is otherwise read-only. The settings page refuses to
 * edit anything because "a settings form on a live trading account is a way to
 * change position sizing at three in the morning with no review and no
 * record". This button changes no sizing, no limit and no rule; it stops the
 * bot asking a model for a second opinion, or starts it asking again. It is
 * the same category as the kill switch, which this page already has.
 *
 * WHAT IT DELIBERATELY CANNOT DO is take the validator out of shadow. Turning
 * it on and off is convenience; moving it from OBSERVING to DECIDING changes
 * what the bot trades, and that belongs in `.env` behind a restart where it
 * leaves a trail.
 *
 * THE STATE SHOWN IS THE SERVER'S, never an optimistic flip. A switch that
 * says "off" because it was clicked, while the request quietly failed, is the
 * most dangerous thing a control panel can show.
 */
export function AiPanel({ initial }: { initial: AiStatus | null }) {
  const [status, setStatus] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch("/api/ai", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as AiStatus;
        if (alive) setStatus(body);
      } catch {
        /* the panel keeps its last known state rather than blanking */
      }
    };
    const timer = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  async function toggle(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/ai/toggle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      const body = (await response.json()) as { enabled?: boolean; error?: string };
      if (!response.ok) {
        setError(body.error ?? "The trading machine did not answer.");
        return;
      }
      // Trust the answer, not the click.
      setStatus((current) => (current ? { ...current, enabled: Boolean(body.enabled) } : current));
    } catch {
      setError("The trading machine did not answer.");
    } finally {
      setBusy(false);
    }
  }

  if (!status) {
    return (
      <p className="text-[var(--color-ink-muted)] text-sm">
        The validator&apos;s status is unavailable. The engine trades on its own rules when it
        is — nothing is blocked by this.
      </p>
    );
  }

  const { quota } = status;
  const drifted = status.enabled !== status.configured;

  return (
    <div className="space-y-6">
      {/* ---- the switch ---- */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--color-solana-bright)]" />
            <span className="text-sm font-medium">AI validation</span>
            {status.shadow && (
              <Badge intent="warn">
                <Eye className="mr-1 h-2.5 w-2.5" />
                watching only
              </Badge>
            )}
          </div>
          <p className="text-[var(--color-ink-muted)] mt-1.5 text-xs leading-relaxed">
            {status.shadow
              ? "The validator reviews every candidate and its answers change nothing. Its verdicts are recorded so they can be compared against what the engine actually did."
              : "The validator decides. Only candidates it approves are opened."}
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={status.enabled}
          aria-label="AI validation"
          disabled={busy}
          onClick={() => toggle(!status.enabled)}
          className={`relative h-7 w-12 shrink-0 rounded-full transition-colors disabled:opacity-50 ${
            status.enabled
              ? "bg-[var(--color-mint-dim)]"
              : "bg-[var(--color-surface-overlay)] border border-[var(--color-border-strong)]"
          }`}
        >
          <span
            className={`absolute top-1 h-5 w-5 rounded-full bg-[var(--color-ink)] transition-transform ${
              status.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
          {busy && (
            <Loader2 className="absolute inset-0 m-auto h-3 w-3 animate-spin text-[var(--color-ink)]" />
          )}
        </button>
      </div>

      {error && <p className="text-[var(--color-loss)] text-xs">{error}</p>}

      {/* A switch a restart undid is otherwise a mystery: the operator turned
          it off, came back, and found it on. Saying so is cheaper than the
          hour somebody would spend not understanding it. */}
      {drifted && (
        <p className="text-[var(--color-warning)] text-xs leading-relaxed">
          Switched {status.enabled ? "on" : "off"} here, but <code>.env</code> says{" "}
          {status.configured ? "on" : "off"} — a restart will go back to that. Change{" "}
          <code>AI_ENABLED</code> to make it stick.
        </p>
      )}

      {/* ---- the quota ---- */}
      <div className="border-[var(--color-border)] space-y-4 border-t pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-medium">Today&apos;s usage</span>
          <span className="text-[var(--color-ink-muted)] text-[11px]">{quota.day} UTC</span>
        </div>

        {/* Its own bar rather than the shared `Gauge`, which formats its
            numbers as PERCENTAGES — it would render $0.0003 of $1.50 as
            "0.03% / 150%". A component reused past what it measures is a
            wrong number with a confident label. */}
        {quota.budgetUsd > 0 ? (
          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <span className="text-[var(--color-ink-secondary)] text-xs">
                {money(quota.spentToday)} of {money(quota.budgetUsd)}
              </span>
              <span className="tabular text-[var(--color-ink-muted)] text-xs">
                {((quota.usedShare ?? 0) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
              <div
                className="h-full rounded-full transition-[width] duration-700"
                style={{
                  width: `${Math.min(100, (quota.usedShare ?? 0) * 100)}%`,
                  background:
                    (quota.usedShare ?? 0) >= 0.9
                      ? "var(--color-warning)"
                      : "var(--color-solana-bright)",
                }}
              />
            </div>
          </div>
        ) : (
          <p className="text-[var(--color-warning)] text-xs">
            No daily ceiling set. {money(quota.spentToday)} spent so far.
          </p>
        )}

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-xs sm:grid-cols-4">
          <div>
            <dt className="text-[var(--color-ink-muted)]">Calls</dt>
            <dd className="mt-0.5 font-medium">{quota.calls}</dd>
          </div>
          <div>
            <dt className="text-[var(--color-ink-muted)]">Per call</dt>
            <dd className="mt-0.5 font-medium">{money(quota.usdPerCall)}</dd>
          </div>
          <div>
            {/* The single most useful number after the dollars: the cache is
                fifty times cheaper than a miss, and a drop to 0% means the
                prompt's fixed half stopped being identical. Nothing else on
                the page would report that until an invoice did. */}
            <dt className="text-[var(--color-ink-muted)]">Cache hits</dt>
            <dd className="mt-0.5 font-medium">{(quota.cacheHitRate * 100).toFixed(0)}%</dd>
          </div>
          <div>
            <dt className="text-[var(--color-ink-muted)]">Tokens</dt>
            <dd className="mt-0.5 font-medium">
              {(quota.inputTokens + quota.outputTokens).toLocaleString()}
            </dd>
          </div>
        </dl>

        <p className="text-[var(--color-ink-muted)] text-[11px] leading-relaxed">
          DeepSeek model {status.model}, up to {status.batchSize} candidates a cycle,{" "}
          {status.timeoutSec}s before it gives up. Past the ceiling the validator stops for the day
          and the engine keeps trading on its own rules.
        </p>
        {status.models && (
          <p className="text-[var(--color-ink-secondary)] text-[11px] leading-relaxed">
            Deciding now:{" "}
            <span className="font-medium text-[var(--color-ink)]">
              {status.models.decider === "claude" ? "Claude" : "DeepSeek"}
            </span>{" "}
            ({status.models.mode}). Switch models, and see Claude&apos;s limits and the
            comparison, on{" "}
            <Link href="/trade?tab=engine" className="text-[var(--color-solana-bright)] underline">
              Trade → Engine &amp; AI
            </Link>
            .
          </p>
        )}
      </div>

      {/* ---- what it has been saying ---- */}
      {status.decisions.length > 0 && (
        <div className="border-[var(--color-border)] border-t pt-5">
          <p className="mb-3 text-sm font-medium">Recent verdicts</p>
          <div className="max-h-[260px] space-y-1.5 overflow-y-auto pr-1">
            {status.decisions.map((decision, index) => (
              <div
                key={`${decision.at}-${decision.symbol}-${index}`}
                className="rounded-lg px-3 py-2 transition-colors hover:bg-[var(--color-surface-overlay)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-medium">{decision.symbol}</span>
                  <Badge intent={decision.side}>{decision.side}</Badge>
                  <Badge
                    intent={
                      decision.verdict === "buy"
                        ? "good"
                        : decision.verdict === "watch"
                          ? "warn"
                          : "neutral"
                    }
                  >
                    {decision.verdict}
                  </Badge>
                  {!decision.acted && (
                    <span className="text-[var(--color-ink-muted)] text-[10px]">not acted on</span>
                  )}
                </div>
                {decision.reason && (
                  <p className="text-[var(--color-ink-secondary)] mt-1 text-[11px] leading-relaxed break-words">
                    {decision.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
