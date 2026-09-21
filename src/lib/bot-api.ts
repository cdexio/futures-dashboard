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

export type Position = {
  symbol: string;
  side: "long" | "short";
  quantity: number;
  entryPrice: number;
  unrealizedPnl: number;
  notional: number;
  stopPrice: number | null;
  takeProfitPrice: number | null;
  protected: boolean;
};

export type AccountSnapshot = {
  equity: number;
  available: number;
  unrealizedPnl: number;
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
  tradingHalted: boolean;
  resetsAt: string;
  asOf: string;
};

export type ActivityEvent = { at: string; level: "info" | "warning" | "error"; message: string };

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
  universe: Record<string, string | number | string[]>;
  data: Record<string, string | number>;
  credentials: Record<string, string>;
};
