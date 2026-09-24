import type { Limits } from "@/lib/bot-api";

/**
 * How to name the loss/profit period the trader is measured over.
 *
 * Weekly from 2026-09-24 (Monday 00:00 UTC); an API older than that reports
 * no `period` and was daily. `dayStartEquity` and friends keep their names on
 * the wire and hold the period's values.
 */
export function limitPeriod(limits: Limits) {
  const weekly = limits.period === "week";
  return {
    weekly,
    /** "Weekly loss", "Daily loss". */
    noun: weekly ? "Weekly" : "Daily",
    /** Where the period's baseline was taken. */
    opened: weekly ? "Week opened at" : "Day opened at",
    resets: weekly ? "resets Monday 00:00 UTC" : "resets 00:00 UTC",
    /** A zero target is OFF, not "already reached". */
    profitOn: limits.profitLimit > 0,
  };
}
