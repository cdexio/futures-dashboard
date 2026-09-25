"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";

/**
 * "Close now" for one open position, confirmed with the PIN.
 *
 * The button reports what the SERVER accepted — a request queued for the bot —
 * not that the position is closed. The bot closes it on its next management
 * pass, within about fifteen seconds, and the position list the page already
 * polls is what shows it gone. Saying "closed" on a click would be claiming a
 * fill nobody has seen.
 */
export function ClosePosition({ symbol, pnl }: { symbol: string; pnl: number | null }) {
  const [asking, setAsking] = useState(false);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/close-position", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ symbol, pin }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(body.error ?? `failed (${response.status})`);
      setSent(true);
      setAsking(false);
      setPin("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <span className="text-xs font-medium text-[var(--color-warning)]">
        Closing — the bot closes it within ~15 s
      </span>
    );
  }

  const result =
    pnl === null ? "" : ` at about ${pnl >= 0 ? "+" : "−"}$${Math.abs(pnl).toFixed(2)}`;

  return (
    <div className="flex flex-col items-end gap-1">
      {asking ? (
        <form
          className="flex flex-wrap items-center justify-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <span className="text-[11px] text-[var(--color-ink-secondary)]">
            Close {symbol}
            {result}?
          </span>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN"
            aria-label="PIN"
            className="w-24 rounded-lg border border-[var(--color-border-strong)] bg-[var(--color-surface)] px-3 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={busy || !pin}
            className="rounded-lg bg-[var(--color-loss)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "…" : "Close"}
          </button>
          <button
            type="button"
            onClick={() => {
              setAsking(false);
              setPin("");
              setError(null);
            }}
            className="rounded-lg px-2 py-1.5 text-sm text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
          >
            Cancel
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setAsking(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-loss)] px-3 py-1.5 text-sm font-medium text-[var(--color-loss)] transition hover:bg-[var(--color-loss)] hover:text-white"
        >
          <LogOut className="h-4 w-4" /> Close now
        </button>
      )}
      {error && <span className="text-xs text-[var(--color-loss)]">{error}</span>}
    </div>
  );
}
