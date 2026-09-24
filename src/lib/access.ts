import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import type { Session } from "next-auth";

import { auth } from "@/lib/auth";
import {
  DEVICE_COOKIE,
  DEVICE_HEADER,
  deviceStatus,
  hashDevice,
  requestApproval,
  type DeviceStatus,
} from "@/lib/devices";

/**
 * The three gates, in order, and the one function that answers all of them.
 *
 *   1. GOOGLE — who holds the mailbox. Lasts 7 days from sign-in, absolute.
 *   2. DEVICE — whether this browser is the owner's or one they approved.
 *   3. PIN    — whether the owner is at the screen right now. Asked again
 *               after 1 hour without a touch, or 15 minutes after the page
 *               was closed or sent to the background.
 *
 * THE PIN'S FRESHNESS LIVES IN ITS OWN COOKIE, `cdx_lock`, signed with the
 * session secret: which session it belongs to, when the page last reported in
 * (`seen`) and when somebody last touched it (`active`). A cookie rather than
 * a JWT field because the heartbeat updates it every minute, and a route
 * handler can set a cookie where a server component cannot rewrite a session.
 *
 * `seen` ADVANCES ONLY WHILE THE PAGE IS VISIBLE. The heartbeat stops when the
 * tab is hidden or the app is closed, so "closed for 15 minutes" is simply
 * "no heartbeat for 15 minutes" — the server needs no word from the browser
 * that it closed, which is a message a killed app never gets to send.
 *
 * A STALE LOCK CANNOT BE REVIVED. The heartbeat refuses to refresh a lock that
 * has already expired, so a script replaying the call cannot keep a forgotten
 * session unlocked; only the PIN route issues a fresh one.
 */

export const LOCK_COOKIE = "cdx_lock";
export const IDLE_LIMIT_MS = 60 * 60 * 1000;
export const CLOSED_LIMIT_MS = 15 * 60 * 1000;

type Lock = { sid: string; seen: number; active: number };

function secret(): string {
  const value = process.env.AUTH_SECRET;
  // Fail closed. An unsigned lock is a lock anybody can write.
  if (!value) throw new Error("AUTH_SECRET is not set");
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function encodeLock(lock: Lock): string {
  const payload = Buffer.from(JSON.stringify(lock)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeLock(raw: string | undefined): Lock | null {
  if (!raw) return null;
  const [payload, signature] = raw.split(".");
  if (!payload || !signature) return null;
  const expected = Buffer.from(sign(payload));
  const supplied = Buffer.from(signature);
  if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) return null;
  try {
    const lock = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Lock;
    if (typeof lock.sid !== "string" || typeof lock.seen !== "number" || typeof lock.active !== "number") {
      return null;
    }
    return lock;
  } catch {
    return null;
  }
}

export function lockIsFresh(lock: Lock | null, sid: string | undefined, now = Date.now()): lock is Lock {
  if (!lock || !sid || lock.sid !== sid) return false;
  return now - lock.seen <= CLOSED_LIMIT_MS && now - lock.active <= IDLE_LIMIT_MS;
}

export const lockCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  // The cookie outliving its freshness is harmless — `lockIsFresh` decides —
  // but it should not outlive the 7-day sign-in it is bound to.
  maxAge: 7 * 24 * 60 * 60,
};

export type AccessStep = "login" | "device" | "pin" | "ok";

export type Access = {
  step: AccessStep;
  session: Session | null;
  email: string | null;
  deviceHash: string | null;
  device: DeviceStatus;
  lock: Lock | null;
};

export async function clientIp(): Promise<string | null> {
  const list = await headers();
  // nginx sets X-Real-IP to the connecting address. X-Forwarded-For's first
  // entry is whatever the client claimed and is only a fallback.
  return list.get("x-real-ip") ?? list.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

async function currentDeviceHash(): Promise<string | null> {
  // The middleware copies the cookie into this header — and mints one on a
  // first visit, before the browser has had a chance to store it. It always
  // overwrites the header, so a client cannot supply its own.
  const token = (await headers()).get(DEVICE_HEADER) ?? (await cookies()).get(DEVICE_COOKIE)?.value;
  return token ? hashDevice(token) : null;
}

export async function getAccess(): Promise<Access> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase() ?? null;
  const deviceHash = await currentDeviceHash();
  const base = { session, email, deviceHash, device: "unknown" as DeviceStatus, lock: null };

  if (!email || !session?.sid) return { ...base, step: "login" };

  const device = await deviceStatus(deviceHash);
  if (device === "unknown") {
    if (deviceHash) {
      const list = await headers();
      await requestApproval(deviceHash, list.get("user-agent") ?? "", await clientIp());
    }
    return { ...base, device, step: "device" };
  }

  const lock = decodeLock((await cookies()).get(LOCK_COOKIE)?.value);
  if (!lockIsFresh(lock, session.sid)) return { ...base, device, lock, step: "pin" };

  return { ...base, device, lock, step: "ok" };
}

/** Where each unfinished step sends the browser. */
export const STEP_PATH: Record<Exclude<AccessStep, "ok">, string> = {
  login: "/login",
  device: "/device",
  pin: "/pin",
};
