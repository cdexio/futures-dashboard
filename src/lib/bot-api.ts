import { auth } from "@/lib/auth";

/**
 * The only path from this app to the bot's data.
 *
 * SERVER-SIDE ONLY. Every caller is a route handler or a server component, so
 * the bot API's address never reaches a browser. It is bound to localhost on
 * the trading machine and has no authentication of its own — the check below
 * IS its access control, and a fetch issued from client code would skip it.
 *
 * BOTH FACTORS ARE CHECKED HERE, not only in middleware. Middleware protects
 * page routes; a data helper that trusted it would be one forgotten matcher
 * away from serving the account to a session that never entered its PIN.
 */
const BASE = process.env.BOT_API_URL ?? "http://127.0.0.1:8790";

export class NotAuthorised extends Error {
  constructor(public readonly reason: "signed-out" | "pin-required") {
    super(reason);
  }
}

export async function requireSession() {
  const session = await auth();
  if (!session?.user?.email) throw new NotAuthorised("signed-out");
  if (!session.pinVerified) throw new NotAuthorised("pin-required");
  return session;
}

/**
 * Read one endpoint of the bot API.
 *
 * `cache: "no-store"` on every call, without exception. A dashboard that
 * shows a cached balance is worse than one that shows none: the number looks
 * authoritative and is wrong, and the reader acts on it. Next caches fetches
 * by default, which is the right default for a blog and the wrong one here.
 */
export async function botFetch<T>(path: string, init?: RequestInit): Promise<T> {
  await requireSession();
  const response = await fetch(`${BASE}${path}`, {
    ...init,
    cache: "no-store",
    // A trading machine that has stopped answering must surface as an error
    // in seconds, not hang a page for the platform's default minute.
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) {
    throw new Error(`bot API ${path} responded ${response.status}`);
  }
  return (await response.json()) as T;
}

/**
 * A non-JSON answer from the bot API — a CSV export — behind the same two
 * factors as `botFetch`. The body and headers are passed through untouched.
 */
export async function botFetchRaw(path: string): Promise<Response> {
  await requireSession();
  return fetch(`${BASE}${path}`, {
    cache: "no-store",
    // An export walks every fill in its window and reads the lake; it is
    // allowed longer than a page read, not forever.
    signal: AbortSignal.timeout(60_000),
  });
}

export type Position = {
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  /** Current price, from the exchange's own mark — not the last trade. */
  markPrice: number;
  /** Null under cross margin, where liquidation is an ACCOUNT-level event and
   *  the exchange reports no per-position level. Shown as such, never as 0. */
  liquidationPrice: number | null;
  leverage: number | null;
  marginUsd: number;
  unrealizedPnl: number;
  /** Return on MARGIN, matching the exchange's own position table. On notional
   *  it would read a twentieth of this at 20x and every row would disagree
   *  with Binance for the same trade. */
  roi: number;
  /** The price move alone, leverage stripped out — whether the thesis is
   *  working, which ROI does not say. */
  priceChange: number;
  notional: number;
  markNotional: number;
  stopPrice: number | null;
  takeProfitPrice: number | null;
  /** Unsigned distance from the mark, as a fraction. */
  stopDistance: number | null;
  takeProfitDistance: number | null;
  liquidationDistance: number | null;
  protected: boolean;
  openedAt: string | null;
  ageMinutes: number | null;
  /** Which of the five routes opened this. Null for a position opened before
   *  the engine recorded provenance, or adopted from an earlier process —
   *  shown as unknown rather than guessed, because "which route is this"
   *  answered wrongly is worse than not answered. */
  strategy: string | null;
  /** The Phase 5 score at entry. Null means it could not be computed, which
   *  is a different fact from zero. */
  score: number | null;
  /** How long this position is allowed to run, from its signal's strength. */
  maxHoldHours: number | null;
  holdRemainingHours: number | null;
};

/** One candle, in the shape the chart draws. Short keys because a 240-bar
 *  series repeats them 240 times and this travels to a phone. */
export type Candle = {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
};

/** What one strategy has actually produced.
 *
 *  The engine runs five and the account reports one blended number, so a route
 *  that loses steadily is invisible inside a book that is roughly flat. */
export type RouteStats = {
  route: string;
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  fees: number;
  winRate: number;
  averageTrade: number;
};

export type AccountSnapshot = {
  equity: number;
  available: number;
  marginUsed: number;
  unrealizedPnl: number;
  openPositions: number;
  maxPositions: number;
  positions: Position[];
  mode: string;
  asOf: string;
};

export type ClosedTrade = {
  symbol: string;
  side: "long" | "short";
  openedAt: string;
  closedAt: string;
  durationMinutes: number;
  entryPrice: number;
  exitPrice: number;
  quantity: number;
  notional: number;
  realizedPnl: number;
  commission: number;
  funding: number;
  netPnl: number;
  roi: number;
};

export type Performance = {
  trades: number;
  wins: number;
  losses: number;
  netPnl: number;
  grossPnl: number;
  fees: number;
  winRate: number;
  averageTrade: number;
  averageWin: number;
  averageLoss: number;
  profitFactor: number;
  maxDrawdown: number;
  bestTrade: number;
  worstTrade: number;
  longestWinStreak: number;
  longestLossStreak: number;
  averageDurationMinutes: number;
  roi: number;
};

export type Analytics = {
  since: string;
  performance: Performance;
  equityCurve: { t: string; equity: number; pnl: number; symbol: string }[];
  daily: { date: string; netPnl: number; trades: number; wins: number }[];
  bySymbol: { symbol: string; netPnl: number; trades: number; wins: number; winRate: number }[];
  openingEquity: number;
  currentEquity: number;
};

export type Limits = {
  dayStartEquity: number;
  currentEquity: number;
  lossLimit: number;
  profitLimit: number;
  lossUsed: number;
  profitUsed: number;
  lossRemaining: number;
  profitRemaining: number;
  /** Peak-to-trough, measured from the highest equity on record rather than
   *  from where the day opened. The two day limits cannot see a good day being
   *  handed back: a run from $100 to $150 and back to $101 reports a daily
   *  loss of zero, which is true and is not what the account just did. */
  peakEquity: number;
  drawdown: number;
  drawdownLimit: number;
  drawdownRemaining: number;
  tradingHalted: boolean;
  /** Which of the three limits stopped trading, or null. Named rather than a
   *  bare boolean: the three call for completely different responses. */
  haltReason: "drawdown" | "daily_loss" | "daily_profit" | null;
  /** The operator's manual stop — a file on the trading machine. Blocks new
   *  entries while still permitting exits. */
  killSwitch: boolean;
  resetsAt: string;
  asOf: string;
};

export type ActivityEvent = {
  at: string;
  level: "info" | "warning" | "error";
  /** A fixed set the dashboard styles by category, so a kind added later
   *  arrives as "info" and is still shown rather than silently dropped. */
  kind:
    | "entry"
    | "exit"
    | "trail"
    | "protect"
    | "reject"
    | "cycle"
    | "signal"
    | "risk"
    | "error"
    | "info"
    /** The validator. Kept as its own kind rather than folded into "info"
     *  because the Live card splits the feed on it, and because an AI line
     *  and an engine line are two different claims about the same trade. */
    | "ai";
  message: string;
  symbol: string | null;
};

/** One candidate kept warm because it ran out of slots, not out of merit.
 *
 *  NO PRICE, and the omission is the design rather than an oversight: a
 *  candidate shelved two hours ago and shown with its two-hour-old entry is
 *  how somebody comes to act on a stale level. What comes back is an identity
 *  and a reason; the engine recomputes everything else before acting. */
export type WatchEntry = {
  symbol: string;
  side: "long" | "short";
  strategy: string;
  reason: string;
  score: number | null;
  since: string;
  until: string;
  secondsLeft: number;
};

/** The validator's state, spend and recent verdicts. */
export type AiStatus = {
  /** What is true right now — the runtime switch. */
  enabled: boolean;
  /** What `.env` will say after the next restart. Shown beside `enabled` so a
   *  switch that a restart undid is visible rather than mysterious. */
  configured: boolean;
  /** Watching only. Not settable from here: moving the validator from
   *  observing to deciding changes what the bot trades. */
  shadow: boolean;
  model: string;
  batchSize: number;
  timeoutSec: number;
  quota: {
    spentToday: number;
    budgetUsd: number;
    /** null when no ceiling is set — a progress bar at 0% would read as
     *  "plenty left", and no ceiling means there is no such thing. */
    usedShare: number | null;
    calls: number;
    cacheHitRate: number;
    usdPerCall: number;
    inputTokens: number;
    outputTokens: number;
    day: string;
  };
  decisions: {
    at: string;
    symbol: string;
    side: "long" | "short";
    strategy: string;
    verdict: "buy" | "skip" | "watch";
    score: number | null;
    reason: string;
    acted: boolean;
    /** The price the verdict is ABOUT. On a buy it is the market fill; on a
     *  watch it is the level the model wanted instead. Null on a skip, and on
     *  every row recorded before the prompt asked for levels. */
    entry: number | null;
    takeProfit: number | null;
    stopLoss: number | null;
    /** Hours the model said the idea deserves, raw. Acted on only when the
     *  validator is deciding, and clamped to the owner's window when it is. */
    maxHoldHours: number | null;
  }[];
};

/** One cycle's scan, stage by stage. Every field optional: a cycle that was
 *  skipped — full book, stale lake — carries only `skipped` and its reason. */
export type ScanSummary = {
  at: string;
  finishedAt?: string;
  skipped?: string;
  universe?: number;
  /** When the current 300 were chosen, and how often they are chosen again. */
  universeChosenAt?: string | null;
  universeRefreshHours?: number;
  withData?: number;
  missingData?: number;
  /** Why each symbol produced nothing on the newest bar, by the first rule
   *  that stopped it. `signal` is the count that got through. */
  engine?: { reason: string; count: number }[];
  windowSignals?: number;
  barClosedAt?: string;
  newestBar?: number;
  byStrategy?: Record<string, number>;
  scoreGate?: { kept: number; dropped: number; summary: string };
  candidates?: { symbol: string; side: string; strategy: string; score: number | null }[];
  ai?: { reviewed: number; buy: number; skip: number; watch: number; shadow: boolean };
  toRunner?: number;
  orders?: number;
  opened?: string[];
  refused?: { reason: string; count: number }[];
  equity?: number;
};

/** One order resting on the exchange. `kind` is what it is FOR: an entry the
 *  market has not taken yet, or the stop / take-profit protecting a position.
 *  `manual` is an order this bot did not place. */
export type OpenOrder = {
  symbol: string;
  kind: "entry" | "stop" | "take_profit" | "exit" | "manual";
  type: string;
  side: string;
  price: number | null;
  quantity: number | null;
  filled: number;
  postOnly: boolean;
  placedAt: string | null;
};

export type ScanHistoryRow = {
  at: string;
  universe: number | null;
  newestBar: number | null;
  toRunner: number | null;
  opened: number;
  orders: number | null;
  skipped: string | null;
};

/** What `/api/live` returns: one instant, both halves. */
export type LiveSnapshot = { account: AccountSnapshot; limits: Limits };

export type Assets = {
  equity: number;
  available: number;
  inPositions: number;
  transfers: { at: string; type: string; asset: string; amount: number }[];
  incomeTotals: Record<string, number>;
  since: string;
};

export type Settings = {
  execution: Record<string, string | number>;
  risk: Record<string, number>;
  exits: Record<string, number>;
  /** Which signals are allowed to become trades. These decide more of the
   *  book than the exit rules do: shorts and momentum being off removes most
   *  of the signal volume, and the range filter removes 69% of what is left. */
  signals: Record<string, string | number | boolean>;
  universe: Record<string, string | number | string[]>;
  data: Record<string, string | number>;
  credentials: Record<string, string>;
  /** Every setting the process runs under, secrets reduced to presence. */
  all?: Record<string, unknown>;
};
