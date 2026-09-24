"use client";

import { motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";

import { BrandMark } from "@/components/brand-mark";

const LENGTH = 6;

/**
 * The second factor.
 *
 * The digits are held in one string and rendered as boxes, rather than kept in
 * six inputs. Six inputs means six pieces of focus state, and paste, backspace
 * and autofill each have to be taught to walk between them — the version with
 * one hidden field has none of those cases because there is nothing to walk.
 */
export default function PinPage() {
  const router = useRouter();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);
  const field = useRef<HTMLInputElement>(null);

  useEffect(() => {
    field.current?.focus();
  }, []);

  async function submit(value: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/pin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      const body = await response.json();
      if (!response.ok) {
        setError(body.error ?? "Incorrect PIN.");
        setPin("");
        setShake((n) => n + 1);
        return;
      }
      // The route set the lock cookie; the layout reads it on the next render.
      router.replace("/");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  function change(raw: string) {
    const digits = raw.replace(/\D/g, "").slice(0, LENGTH);
    setPin(digits);
    setError(null);
    if (digits.length === LENGTH) void submit(digits);
  }

  return (
    <main className="relative z-10 grid min-h-screen place-items-center px-6">
      <motion.div
        key={shake}
        initial={shake ? { x: 0 } : false}
        animate={shake ? { x: [0, -10, 9, -6, 3, 0] } : {}}
        transition={{ duration: 0.42 }}
        className="glass ring-solana w-full max-w-md rounded-3xl p-10"
      >
        <BrandMark subtitle="Security" />

        <div className="mt-8 flex items-center gap-2 text-[var(--color-mint)]">
          <ShieldCheck className="h-4 w-4" />
          <span className="text-xs font-medium tracking-wide uppercase">Second factor</span>
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight">Enter your PIN</h1>
        <p className="text-[var(--color-ink-secondary)] mt-2 text-sm leading-relaxed">
          Google confirmed the account. This confirms it is you at the keyboard.
        </p>

        <button
          type="button"
          onClick={() => field.current?.focus()}
          className="mt-8 flex w-full justify-between gap-2"
          aria-label="PIN entry"
        >
          {Array.from({ length: LENGTH }).map((_, index) => {
            const filled = index < pin.length;
            const active = index === pin.length;
            return (
              <motion.span
                key={index}
                animate={{
                  scale: active ? 1.06 : 1,
                  borderColor: filled
                    ? "var(--color-solana)"
                    : active
                      ? "var(--color-solana-dim)"
                      : "var(--color-border)",
                }}
                transition={{ type: "spring", stiffness: 420, damping: 26 }}
                className="grid h-14 flex-1 place-items-center rounded-xl border-2 bg-[var(--color-surface-raised)]"
              >
                {filled && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="h-2.5 w-2.5 rounded-full bg-[var(--color-solana-bright)]"
                  />
                )}
              </motion.span>
            );
          })}
        </button>

        <input
          ref={field}
          type="password"
          inputMode="numeric"
          autoComplete="one-time-code"
          value={pin}
          disabled={busy}
          onChange={(event) => change(event.target.value)}
          className="sr-only"
          aria-label="PIN"
        />

        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 text-center text-sm text-[var(--color-loss)]"
          >
            {error}
          </motion.p>
        )}

        <p className="text-[var(--color-ink-muted)] mt-8 text-center text-xs leading-relaxed">
          Asked again after 1 hour idle, or 15 minutes after the app is closed.
          <br />
          Five wrong attempts locks entry for 15 minutes.
        </p>
      </motion.div>
    </main>
  );
}
