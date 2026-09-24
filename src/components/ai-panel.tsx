"use client";

import { useEffect, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import type { AiStatus } from "@/lib/bot-api";

/**
 * The validator's on/off switch — and, since 2026-09-24, nothing else. The
 * owner asked for the switch alone; usage and verdicts are on Trade → Engine.
 *
 * THE SWITCH IS OPERATIONAL, NOT A SETTING, and that distinction is why it is
 * allowed on a page that is otherwise read-only: it changes no sizing, no
 * limit and no rule, only whether the bot asks a model for a second opinion.
 * The same category as the kill switch.
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
    return <p className="text-[var(--color-ink-muted)] text-sm">AI status unavailable.</p>;
  }

  const drifted = status.enabled !== status.configured;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[var(--color-solana-bright)]" />
          <span className="text-sm font-medium">AI validation</span>
          <span className="text-[var(--color-ink-muted)] text-xs">
            {status.enabled ? "On" : "Off"}
          </span>
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

      {/* A switch a restart undid is otherwise a mystery. */}
      {drifted && (
        <p className="text-[var(--color-warning)] text-xs">
          Resets to {status.configured ? "on" : "off"} on restart (<code>AI_ENABLED</code>).
        </p>
      )}
    </div>
  );
}
