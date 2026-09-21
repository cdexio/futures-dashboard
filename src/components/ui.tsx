"use client";

import { motion, useInView } from "motion/react";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

import { TONE_CLASS, tone } from "@/lib/format";

/**
 * A card that arrives as the reader reaches it.
 *
 * `once: true` matters more than it looks. A card that re-animates every time
 * it scrolls back into view turns an ordinary scroll up the page into a
 * flickering mess, and on a dashboard somebody is scrolling up to RE-READ a
 * number they just saw.
 */
export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const seen = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={seen ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function Card({
  children,
  className,
  hoverable = true,
}: {
  children: React.ReactNode;
  className?: string;
  hoverable?: boolean;
}) {
  return (
    <div
      className={clsx("glass rounded-2xl", hoverable && "glass-hover", className)}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  hint,
  right,
}: {
  title: string;
  hint?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        {hint && <p className="text-[var(--color-ink-muted)] mt-1 text-xs">{hint}</p>}
      </div>
      {right}
    </div>
  );
}

/**
 * A number that counts to its value.
 *
 * Only on mount, and only over 700ms. A figure that re-counts on every poll
 * would be unreadable on a page that refreshes every few seconds — the
 * animation exists to draw the eye once, not to narrate each update.
 */
export function Counter({
  value,
  render,
  className,
}: {
  value: number;
  render: (v: number) => string;
  className?: string;
}) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const seen = useInView(ref, { once: true });

  useEffect(() => {
    if (!seen) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setShown(value);
      return;
    }
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      // Ease-out cubic: fast first, settling at the end, so the final digits
      // are legible rather than a blur that stops abruptly.
      setShown(value * (1 - Math.pow(1 - t, 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [seen, value]);

  return (
    <span ref={ref} className={className}>
      {render(seen ? shown : 0)}
    </span>
  );
}

export function StatCard({
  label,
  value,
  sub,
  signed,
  icon,
  delay = 0,
}: {
  label: string;
  value: number;
  sub?: string;
  signed?: boolean;
  icon?: React.ReactNode;
  delay?: number;
  render?: (v: number) => string;
}) {
  const colour = signed ? TONE_CLASS[tone(value)] : "text-[var(--color-ink)]";
  return (
    <Reveal delay={delay}>
      <Card className="p-5">
        <div className="flex items-start justify-between">
          <span className="text-[var(--color-ink-muted)] text-[11px] font-medium tracking-[0.12em] uppercase">
            {label}
          </span>
          {icon && <span className="text-[var(--color-ink-muted)]">{icon}</span>}
        </div>
        <div className={clsx("tabular mt-3 text-2xl font-semibold", colour)}>
          {/* Value passed pre-formatted by the caller via children is avoided
              on purpose: the counter needs the number, not its string. */}
          {typeof value === "number" ? value.toFixed(2) : value}
        </div>
        {sub && <div className="text-[var(--color-ink-muted)] mt-1.5 text-xs">{sub}</div>}
      </Card>
    </Reveal>
  );
}

/** A pre-formatted statistic. Used where the value is not a plain number —
 *  a ratio, a duration, a count with a unit. */
export function Stat({
  label,
  children,
  sub,
  className,
  delay = 0,
}: {
  label: string;
  children: React.ReactNode;
  sub?: string;
  className?: string;
  delay?: number;
}) {
  return (
    <Reveal delay={delay}>
      <Card className="p-5">
        <span className="text-[var(--color-ink-muted)] text-[11px] font-medium tracking-[0.12em] uppercase">
          {label}
        </span>
        <div className={clsx("tabular mt-3 text-2xl font-semibold", className)}>{children}</div>
        {sub && <div className="text-[var(--color-ink-muted)] mt-1.5 text-xs">{sub}</div>}
      </Card>
    </Reveal>
  );
}

export function Badge({
  children,
  intent = "neutral",
}: {
  children: React.ReactNode;
  intent?: "neutral" | "long" | "short" | "good" | "bad" | "warn";
}) {
  const styles = {
    neutral: "border-[var(--color-border-strong)] text-[var(--color-ink-secondary)]",
    long: "border-[var(--color-mint-dim)] text-[var(--color-mint)] bg-[var(--color-mint)]/8",
    short: "border-[var(--color-loss)]/40 text-[var(--color-loss)] bg-[var(--color-loss)]/8",
    good: "border-[var(--color-mint-dim)] text-[var(--color-mint)] bg-[var(--color-mint)]/8",
    bad: "border-[var(--color-loss)]/40 text-[var(--color-loss)] bg-[var(--color-loss)]/8",
    warn: "border-[var(--color-warning)]/40 text-[var(--color-warning)] bg-[var(--color-warning)]/8",
  }[intent];
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
        styles,
      )}
    >
      {children}
    </span>
  );
}

/**
 * A capacity bar — how much of an allowance is spent.
 *
 * Filled from the left with the amount USED, not the amount remaining. A bar
 * that empties as risk is taken reads as progress toward something good; this
 * one fills as the day is spent, which is what is actually happening.
 */
export function Gauge({
  used,
  limit,
  intent,
  label,
}: {
  used: number;
  limit: number;
  intent: "good" | "bad";
  label: string;
}) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
  const colour = intent === "good" ? "var(--color-profit)" : "var(--color-loss)";
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-[var(--color-ink-secondary)] text-xs">{label}</span>
        <span className="tabular text-xs" style={{ color: colour }}>
          {(used * 100).toFixed(2)}% / {(limit * 100).toFixed(0)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
          className="h-full rounded-full"
          style={{ background: colour }}
        />
      </div>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="border-[var(--color-border)] grid place-items-center rounded-2xl border border-dashed px-6 py-14 text-center">
      <p className="text-[var(--color-ink-secondary)] text-sm font-medium">{title}</p>
      {hint && <p className="text-[var(--color-ink-muted)] mt-1.5 text-xs">{hint}</p>}
    </div>
  );
}

export function LiveDot({ label = "Live" }: { label?: string }) {
  return (
    <span className="text-[var(--color-ink-muted)] inline-flex items-center gap-2 text-[11px] tracking-wide uppercase">
      <span className="live-dot h-1.5 w-1.5 rounded-full bg-[var(--color-mint)]" />
      {label}
    </span>
  );
}
