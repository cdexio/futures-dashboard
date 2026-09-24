"use client";

import { useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";

/** The fingerprint, grouped in fours so it can be read aloud or compared by
 *  eye, with a copy button for the full value. */
export function DeviceCode({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(hash);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard needs a secure context and a gesture; the code stays
      // selectable on screen either way.
    }
  }

  return (
    <>
      <div className="mt-3 rounded-xl border bg-[var(--color-surface-raised)] p-4">
        <div className="tabular text-[13px] leading-relaxed break-all select-all">
          {hash.match(/.{1,4}/g)?.join(" ")}
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={copy}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border-strong)] px-4 py-2.5 text-sm"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? "Copied" : "Copy code"}
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--color-border-strong)] px-4 py-2.5 text-sm"
        >
          <RefreshCw className="h-4 w-4" /> Check again
        </button>
      </div>
    </>
  );
}
