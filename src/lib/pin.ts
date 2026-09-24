import { createHash, timingSafeEqual } from "node:crypto";

/**
 * The PIN re-typed to confirm one action — resuming trading, approving a
 * device — as opposed to the PIN that unlocks the session (src/app/api/pin).
 * Fails closed when no hash is configured, as that route does.
 */
export function pinMatches(pin: unknown): boolean {
  const expected = process.env.DASHBOARD_PIN_SHA256;
  if (!expected) return false;
  const supplied = createHash("sha256").update(String(pin ?? ""), "utf8").digest();
  const stored = Buffer.from(expected, "hex");
  return stored.length === supplied.length && timingSafeEqual(stored, supplied);
}
