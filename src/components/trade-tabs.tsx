"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Activity, Wallet } from "lucide-react";

export type TradeTab = "positions" | "engine";

const TABS: { id: TradeTab; label: string; icon: typeof Wallet }[] = [
  { id: "positions", label: "Positions & orders", icon: Wallet },
  { id: "engine", label: "Engine & AI", icon: Activity },
];

/**
 * The Trade page's two halves: what the account holds, and what the bot is
 * thinking. Links, not buttons — the tab lives in the URL, so a reload or a
 * shared link lands on the same half, and the back button works.
 */
export function TradeTabs({ active }: { active: TradeTab }) {
  return (
    <div
      role="tablist"
      aria-label="Trade sections"
      className="inline-flex rounded-xl bg-[var(--color-surface-overlay)] p-1"
    >
      {TABS.map(({ id, label, icon: Icon }) => {
        const selected = id === active;
        return (
          <Link
            key={id}
            href={id === "positions" ? "/trade" : `/trade?tab=${id}`}
            role="tab"
            aria-selected={selected}
            scroll={false}
            className={`relative rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              selected
                ? "text-[var(--color-ink)]"
                : "text-[var(--color-ink-muted)] hover:text-[var(--color-ink-secondary)]"
            }`}
          >
            {selected && (
              <motion.span
                layoutId="trade-tab"
                className="absolute inset-0 rounded-lg bg-[var(--color-surface)] shadow-sm"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
