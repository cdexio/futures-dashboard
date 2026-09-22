"use client";

import { useEffect, useState } from "react";
import { OctagonX, Play } from "lucide-react";

/**
 * One button that stops the bot opening positions, and a PIN to resume.
 *
 * The state shown is the state the SERVER reports, updated by the live poll
 * the Trade page already runs — not an optimistic flip. A button that says
 * "stopped" because it was clicked, while the request quietly failed, is the
 * single most dangerous thing this page could show.
 */
export function KillSwitch({ engaged }: { engaged: boolean }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState<boolean | null>(null);

  // The poll catches up within seconds; until it does, the confirmed answer
  // from our own request is the newest truth available.
  const shown = override ?? engaged;

  // Once the poll reports the same state, hand control back to it — otherwise
  // a later change made from elsewhere (SSH, the bot's own limits) would be
  // masked forever by a click that happened minutes ago.
  useEffect(() => {
    if (override !== null && override === engaged) setOverride(null);
  }, [engaged, override]);

  async function send(next: boolean) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/kill-switch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ engaged: next, pin }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        killSwitch?: boolean;
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? `failed (${response.status})`);
      setOverride(Boolean(body.killSwitch));
      setAsking(false);
      setPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (!shown) {
    return (
      <div className="flex flex-col items-end gap-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => send(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-loss)] px-4 py-2.5 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-60"
        >
          <OctagonX className="h-4 w-4" />
          {busy ? "Stopping…" : "Stop the bot"}
        </button>
        {error && <span className="text-xs text-[var(--color-loss)]">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <span className="text-xs font-semibold tracking-wide text-[var(--color-warning)] uppercase">
        Bot stopped — no new positions
      </span>
      {asking ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send(false);
          }}
        >
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            className="w-28 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface-raised)] px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !pin}
            className="rounded-lg bg-[var(--color-mint)] px-3 py-2 text-sm font-semibold text-black disabled:opacity-60"
          >
            {busy ? "…" : "Resume"}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-strong)] px-4 py-2 text-sm"
        >
          <Play className="h-4 w-4" /> Resume trading
        </button>
      )}
      {error && <span className="text-xs text-[var(--color-loss)]">{error}</span>}
    </div>
  );
}
