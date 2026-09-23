"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { Check, Eye, Sparkles, X } from "lucide-react";

import { Badge } from "@/components/ui";
import type { AiStatus } from "@/lib/bot-api";
import { price, relative } from "@/lib/format";

const VERDICT = {
  buy: { icon: Check, intent: "good" as const, said: "worth buying" },
  skip: { icon: X, intent: "neutral" as const, said: "refused" },
  watch: { icon: Eye, intent: "warn" as const, said: "kept for later" },
};

type Decision = AiStatus["decisions"][number];

/**
 * The three prices a verdict carries, or nothing at all.
 *
 * WHAT "ENTRY" MEANS DEPENDS ON THE VERDICT, and the label says which rather
 * than leaving a reader to infer it. On a buy it is the fill; on a watch it is
 * the price the model wanted INSTEAD of the one quoted — the whole content of
 * the refusal, and the thing that was missing when every verdict rendered as a
 * bare sentence.
 *
 * Rendered only when something is there. A skip has no levels by design, and a
 * row of dashes on every refusal would be three columns of noise on the verdict
 * this list is mostly made of. The same emptiness covers rows written before
 * the prompt asked for levels, which is correct: they were never asked.
 */
function Levels({ decision }: { decision: Decision }) {
  const { entry, takeProfit, stopLoss } = decision;
  if (entry === null && takeProfit === null && stopLoss === null) {
    return null;
  }
  const entryLabel = decision.verdict === "watch" ? "wants" : "entry";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
      {entry !== null && (
        <span className="text-[var(--color-ink-secondary)]">
          {entryLabel} <span className="tabular text-[var(--color-ink)]">{price(entry)}</span>
        </span>
      )}
      {takeProfit !== null && (
        <span className="text-[var(--color-ink-secondary)]">
          TP <span className="tabular text-[var(--color-profit)]">{price(takeProfit)}</span>
        </span>
      )}
      {stopLoss !== null && (
        <span className="text-[var(--color-ink-secondary)]">
          SL <span className="tabular text-[var(--color-loss)]">{price(stopLoss)}</span>
        </span>
      )}
      {decision.maxHoldHours !== null && (
        <span className="text-[var(--color-ink-secondary)]">
          hold <span className="tabular text-[var(--color-ink)]">{decision.maxHoldHours}h</span>
        </span>
      )}
    </div>
  );
}

/**
 * The agreed review, kept on screen so it does not depend on anyone
 * remembering it: after 30 deciding-mode buys with a complete four-hour
 * window, do they beat the skips? If not, the validator goes back to shadow.
 */
function Checkpoint({ checkpoint }: { checkpoint: AiStatus["checkpoint"] }) {
  if (!checkpoint || checkpoint.buys === null || checkpoint.buys === undefined) return null;
  const { target, buys, buyMean4h, skipMean4h, reached } = checkpoint;
  const pct = (v: number | null | undefined) =>
    v === null || v === undefined ? "—" : `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  const winning =
    buyMean4h !== null && buyMean4h !== undefined && skipMean4h !== null && skipMean4h !== undefined
      ? buyMean4h > skipMean4h
      : null;
  return (
    <div
      className={`mb-3 rounded-lg border px-3 py-2 text-[11px] leading-relaxed ${
        reached
          ? "border-[var(--color-warning)]/40 bg-[var(--color-warning)]/[0.08] text-[var(--color-warning)]"
          : "border-[var(--color-border)] text-[var(--color-ink-secondary)]"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">
          AI review checkpoint · {Math.min(buys, target)} / {target} buys measured
        </span>
        <span className="tabular">
          buys {pct(buyMean4h)} vs skips {pct(skipMean4h)} after 4h
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
        <div
          className="h-full rounded-full bg-[var(--color-solana)]"
          style={{ width: `${Math.min(buys / target, 1) * 100}%` }}
        />
      </div>
      {reached && (
        <p className="mt-1.5">
          Checkpoint reached —{" "}
          {winning
            ? "the buys beat the skips: keep the AI deciding."
            : "the buys did NOT beat the skips: as agreed, put the AI back in shadow."}
        </p>
      )}
    </div>
  );
}

/**
 * What the validator said about each candidate, and why.
 *
 * READ FROM THE DATABASE, NOT FROM THE JOURNAL. The engine tab parses log
 * lines because the engine's decisions only exist as log lines; the
 * validator's are rows, with the verdict, the score and the reason each in
 * their own column. Rendering those directly means the verdict can be a badge
 * rather than a word inside a sentence, and it survives the journal rotating.
 *
 * `not acted on` is printed on every shadow verdict rather than once at the
 * top. A reader scrolling a list of refusals has to be able to tell an opinion
 * from an instruction at the row they are looking at, not by remembering a
 * header.
 */
export function AiVerdicts({ initial }: { initial: AiStatus | null }) {
  const [status, setStatus] = useState(initial);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const response = await fetch("/api/ai", { cache: "no-store" });
        if (!response.ok) return;
        const body = (await response.json()) as AiStatus;
        if (alive) setStatus(body);
      } catch {
        /* keep the last known verdicts rather than blanking the card */
      }
    };
    void tick();
    const timer = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  if (!status) {
    return (
      <p className="text-[var(--color-ink-muted)] px-3 py-8 text-center text-xs">
        The validator&apos;s verdicts are unavailable. The engine trades on its own rules when
        they are.
      </p>
    );
  }

  const { quota } = status;
  const counts = status.decisions.reduce<Record<string, number>>((acc, d) => {
    acc[d.verdict] = (acc[d.verdict] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      {/* The running total, so a reader can see at a glance whether the
          validator is refusing everything — which is a failure mode, not
          caution, and one this system has already had. */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px]">
        <span className="text-[var(--color-ink-muted)]">last {status.decisions.length}:</span>
        <span className="text-[var(--color-profit)]">{counts.buy ?? 0} buy</span>
        <span className="text-[var(--color-ink-secondary)]">{counts.skip ?? 0} skip</span>
        <span className="text-[var(--color-warning)]">{counts.watch ?? 0} watch</span>
        <span className="text-[var(--color-ink-muted)] ml-auto">
          ${quota.spentToday.toFixed(4)} today
        </span>
      </div>

      <Checkpoint checkpoint={status.checkpoint} />

      {status.decisions.length > 0 && (counts.buy ?? 0) === 0 && (
        <p className="mb-3 rounded-lg border border-[var(--color-warning)]/30 bg-[var(--color-warning)]/[0.06] px-3 py-2 text-[11px] leading-relaxed text-[var(--color-warning)]">
          Every recent candidate was refused. These had already passed regime routing, strategy
          selection, an entry ceiling and a score — so a validator refusing all of them is applying
          the wrong standard, not being careful.
        </p>
      )}

      <div className="max-h-[420px] space-y-1.5 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {status.decisions.map((decision, index) => {
            const shape = VERDICT[decision.verdict] ?? VERDICT.skip;
            const Icon = shape.icon;
            return (
              <motion.div
                key={`${decision.at}-${decision.symbol}-${index}`}
                layout
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-surface-overlay)]"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Icon
                    className={`h-3.5 w-3.5 shrink-0 ${
                      decision.verdict === "buy"
                        ? "text-[var(--color-profit)]"
                        : decision.verdict === "watch"
                          ? "text-[var(--color-warning)]"
                          : "text-[var(--color-ink-muted)]"
                    }`}
                  />
                  <span className="text-xs font-semibold">{decision.symbol}</span>
                  <Badge intent={decision.side}>{decision.side}</Badge>
                  <span className="text-[var(--color-ink-muted)] text-[10px]">
                    {decision.strategy}
                  </span>
                  <Badge intent={shape.intent}>{shape.said}</Badge>
                  {decision.score !== null && (
                    <span className="text-[var(--color-ink-muted)] text-[10px]">
                      score {decision.score.toFixed(3)}
                    </span>
                  )}
                  {!decision.acted && (
                    <span className="text-[var(--color-ink-muted)] ml-auto text-[10px]">
                      not acted on
                    </span>
                  )}
                </div>
                {decision.reason && (
                  <p className="text-[var(--color-ink-secondary)] mt-1.5 text-[11px] leading-relaxed break-words">
                    {decision.reason}
                  </p>
                )}
                <Levels decision={decision} />
                <p className="text-[var(--color-ink-muted)] mt-1 text-[10px]">
                  {relative(decision.at)}
                </p>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!status.decisions.length && (
          <p className="text-[var(--color-ink-muted)] px-3 py-8 text-center text-xs">
            <Sparkles className="mx-auto mb-2 h-4 w-4 opacity-50" />
            The validator has not spoken yet. It reviews candidates once a cycle, and only when
            there are candidates to review.
          </p>
        )}
      </div>
    </div>
  );
}
