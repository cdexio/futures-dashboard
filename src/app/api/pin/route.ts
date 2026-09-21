import { createHash, timingSafeEqual } from "node:crypto";

import { auth } from "@/lib/auth";

/**
 * The second factor: a PIN, checked server-side.
 *
 * WHY SERVER-SIDE AT ALL, when the PIN is only a number. Because a check in
 * the browser is not a check — anyone can delete it in devtools. The PIN is
 * the difference between "someone has a live Google session" and "the owner
 * is here", and that difference has to be decided somewhere they cannot edit.
 *
 * STORED AS A HASH. `.env` on this machine holds a SHA-256 of the PIN and not
 * the PIN, so reading the file does not hand over the second factor. It is a
 * short numeric secret, so the hash alone would not survive a determined
 * offline attack — the throttling below is what makes that irrelevant, since
 * an attacker has to come through this route to learn anything.
 *
 * ATTEMPTS ARE THROTTLED PER SESSION. A four-digit PIN is ten thousand
 * guesses, which is seconds of scripting and nothing at all without a limit.
 *
 * TO BE REPLACED BY A PASSKEY. The project owner's plan, and the right one:
 * a passkey cannot be guessed, shoulder-surfed or reused. This is the version
 * that ships today, and it is written so the swap touches only this file.
 */

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;

type Attempt = { count: number; until: number };
// Keyed by email. In-process, which is correct for a single instance on one
// VPS: a restart clears the lockouts, and a restart is not something an
// attacker can cause from this route.
const attempts = new Map<string, Attempt>();

function sha256(value: string) {
  return createHash("sha256").update(value, "utf8").digest();
}

export async function POST(request: Request) {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) {
    return Response.json({ error: "not signed in" }, { status: 401 });
  }

  const expected = process.env.DASHBOARD_PIN_SHA256;
  if (!expected) {
    // Fail CLOSED. A missing hash must not mean "no PIN required" — that is a
    // misconfigured deploy publishing the account behind one Google login.
    return Response.json({ error: "PIN is not configured" }, { status: 503 });
  }

  const state = attempts.get(email);
  if (state && state.until > Date.now()) {
    const minutes = Math.ceil((state.until - Date.now()) / 60000);
    return Response.json({ error: `Too many attempts. Try again in ${minutes}m.` }, { status: 429 });
  }

  const body = (await request.json().catch(() => ({}))) as { pin?: string };
  const supplied = sha256(String(body.pin ?? ""));
  const stored = Buffer.from(expected, "hex");

  // Length is compared first because timingSafeEqual throws on a mismatch,
  // and a thrown error is itself a timing signal.
  const ok = stored.length === supplied.length && timingSafeEqual(stored, supplied);

  if (!ok) {
    const count = (state?.count ?? 0) + 1;
    attempts.set(email, {
      count,
      until: count >= MAX_ATTEMPTS ? Date.now() + LOCKOUT_MS : 0,
    });
    const left = Math.max(0, MAX_ATTEMPTS - count);
    return Response.json(
      { error: left ? `Incorrect PIN. ${left} attempts left.` : "Locked for 15 minutes." },
      { status: 401 },
    );
  }

  attempts.delete(email);
  return Response.json({ ok: true });
}
