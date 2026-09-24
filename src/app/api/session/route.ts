import { cookies, headers } from "next/headers";

import {
  LOCK_COOKIE,
  STEP_PATH,
  clientIp,
  encodeLock,
  getAccess,
  lockCookieOptions,
} from "@/lib/access";
import { touchDevice } from "@/lib/devices";

/**
 * The heartbeat. The open page posts here about once a minute while it is
 * visible, carrying when somebody last touched it.
 *
 * It EXTENDS a fresh lock and never revives a stale one: `getAccess` has
 * already judged the lock as it stood, and a lock it called stale answers
 * with the step to go to instead. The client then sends the browser there.
 *
 * `active` is the browser's claim and is clamped: never in the future, never
 * earlier than what the lock already holds. A client can report activity it
 * did not have — that is a script holding a live, PIN-verified cookie, which
 * is already past everything this route could stop.
 */
export async function POST(request: Request) {
  const access = await getAccess();
  if (access.step !== "ok" || !access.lock || !access.session || !access.deviceHash) {
    const step = access.step === "ok" ? "pin" : access.step;
    return Response.json({ step, redirect: STEP_PATH[step] }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { active?: number };
  const now = Date.now();
  const claimed = typeof body.active === "number" && Number.isFinite(body.active) ? body.active : 0;
  const active = Math.min(now, Math.max(access.lock.active, claimed));

  (await cookies()).set(
    LOCK_COOKIE,
    encodeLock({ sid: access.session.sid, seen: now, active }),
    lockCookieOptions,
  );

  await touchDevice(access.deviceHash, (await headers()).get("user-agent") ?? "", await clientIp());
  return Response.json({ step: "ok", active });
}
