/**
 * Formatting, in one place, because the same number formatted two ways on two
 * pages reads as two different numbers.
 */

/** USDT, always signed for PnL so a loss cannot be misread as a gain. */
export function money(value: number, opts: { signed?: boolean; digits?: number } = {}) {
  const digits = opts.digits ?? 2;
  const body = Math.abs(value).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  if (!opts.signed) return `$${body}`;
  return `${value < 0 ? "−" : "+"}$${body}`;
}

export function percent(value: number, opts: { signed?: boolean; digits?: number } = {}) {
  const digits = opts.digits ?? 2;
  const body = (Math.abs(value) * 100).toFixed(digits);
  if (!opts.signed) return `${body}%`;
  return `${value < 0 ? "−" : "+"}${body}%`;
}

/**
 * Prices keep the precision the symbol trades at, not a fixed two decimals.
 * 1000PEPEUSDT at "$0.00" is not a rounding choice, it is a missing price.
 */
export function price(value: number) {
  if (value === 0) return "0";
  const magnitude = Math.abs(value);
  const digits = magnitude >= 100 ? 2 : magnitude >= 1 ? 4 : magnitude >= 0.01 ? 5 : 8;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: digits,
  });
}

export function quantity(value: number) {
  return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

/** UTC, spelled out. Every limit in this system rolls at UTC midnight, and a
 *  timestamp in the reader's own zone would sit on the wrong side of it. */
export function utcTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });
}

export function utcDateTime(iso: string) {
  const at = new Date(iso);
  return `${at.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  })} ${utcTime(iso)}`;
}

export function duration(minutes: number) {
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes % 60);
  if (hours < 24) return rest ? `${hours}h ${rest}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

export function relative(iso: string) {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return `${Math.floor(seconds)}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/** Profit / loss / flat. Returned as a token name so the caller picks the
 *  class, keeping colour decisions in the stylesheet rather than in logic. */
export function tone(value: number): "profit" | "loss" | "flat" {
  if (value > 0) return "profit";
  if (value < 0) return "loss";
  return "flat";
}

export const TONE_CLASS: Record<"profit" | "loss" | "flat", string> = {
  profit: "text-[var(--color-profit)]",
  loss: "text-[var(--color-loss)]",
  flat: "text-[var(--color-ink-secondary)]",
};

/** Chart series colours, in fixed order. Never cycled: a ninth series folds
 *  into "Other" rather than reusing slot one, because a repeated hue makes two
 *  different things look like the same thing. */
export const SERIES = [
  "var(--color-series-1)",
  "var(--color-series-2)",
  "var(--color-series-3)",
  "var(--color-series-4)",
  "var(--color-series-5)",
];
