"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

/**
 * What a page shows when the trading machine did not answer, instead of a
 * bare "Internal Server Error".
 *
 * Every page reads the bot API on the server. When one of those reads failed
 * — most often Binance refusing a request with 429 because the IP had spent
 * its per-minute allowance — the whole page threw and Next answered 500 with
 * nothing on it, not even the navigation to go somewhere else.
 *
 * This keeps the shell, says what happened in plain words, and retries on its
 * own after a few seconds: the usual cause clears within a minute, and a
 * reader should not have to keep pressing refresh to find out that it has.
 */
export default function PageError({ reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    const timer = setTimeout(reset, 8000);
    return () => clearTimeout(timer);
  }, [reset]);

  return (
    <div className="grid place-items-center py-24">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">The trading machine is busy</h1>
        <p className="text-[var(--color-ink-secondary)] mt-3 text-sm leading-relaxed">
          This page could not load its numbers just now — usually because Binance asked the
          server to slow down for a moment. Nothing about the bot or your positions changed.
          Retrying automatically in a few seconds.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-[var(--color-border-strong)] px-4 py-2 text-sm"
        >
          <RefreshCw className="h-4 w-4" /> Retry now
        </button>
      </div>
    </div>
  );
}
