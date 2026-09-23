"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

/**
 * Every setting the bot runs under — all of them, searchable.
 *
 * The curated groups above explain the important few in words. This is the
 * complete list, straight from `engine/config.py` as the running process sees
 * it, because a curated list is how `allowShorts` and `momentumEnabled` came
 * to be documented as off while they were running on. Secrets arrive already
 * reduced to "configured" / "missing"; nothing here can reveal one.
 */
export function AllSettings({ values }: { values: Record<string, unknown> }) {
  const [query, setQuery] = useState("");
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.entries(values).filter(
      ([key, value]) => !q || key.includes(q) || String(value).toLowerCase().includes(q),
    );
  }, [values, query]);

  return (
    <div>
      <label className="relative mb-3 block">
        <Search className="text-[var(--color-ink-muted)] absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={`Filter ${Object.keys(values).length} settings — e.g. "hold", "ai_", "risk"`}
          className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-overlay)] py-2 pr-3 pl-8 text-xs outline-none focus:border-[var(--color-solana)]"
        />
      </label>
      <dl className="max-h-[520px] divide-y divide-[var(--color-border)]/60 overflow-y-auto pr-1">
        {rows.map(([key, value]) => (
          <div key={key} className="flex items-start justify-between gap-4 py-2">
            <dt className="text-[var(--color-ink-secondary)] min-w-0 font-mono text-[11px] break-all">
              {key}
            </dt>
            <dd className="tabular max-w-[55%] text-right text-[11px] font-medium break-words">
              {value === null || value === undefined ? "—" : String(value)}
            </dd>
          </div>
        ))}
        {!rows.length && (
          <p className="text-[var(--color-ink-muted)] py-4 text-center text-xs">No setting matches.</p>
        )}
      </dl>
    </div>
  );
}
