import { NotAuthorised, requireSession } from "@/lib/bot-api";
import { approveDevice, listDevices, removeDevice } from "@/lib/devices";
import { pinMatches } from "@/lib/pin";

/**
 * The device list, and approving or removing devices.
 *
 * READ from any approved device; CHANGED only from the owner's. An extra
 * device that could approve others would let one lost phone hand out access
 * to more, and the whole point of the lock is that one device is the root.
 *
 * ASYMMETRIC, like the kill switch. Removing a device is defensive and takes
 * one tap. Approving one grants access to the account, so it needs the PIN
 * typed again — a phone left unlocked on the owner's desk should not be able
 * to approve the stranger standing next to it.
 */

async function gate() {
  try {
    return await requireSession();
  } catch (error) {
    if (error instanceof NotAuthorised) {
      return Response.json({ error: error.reason }, { status: 401 });
    }
    throw error;
  }
}

export async function GET() {
  const access = await gate();
  if (access instanceof Response) return access;
  const list = await listDevices(access.deviceHash);
  return Response.json({ ...list, canManage: access.device === "owner" });
}

export async function POST(request: Request) {
  const access = await gate();
  if (access instanceof Response) return access;
  if (access.device !== "owner") {
    return Response.json({ error: "Devices can only be managed from the owner device." }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    hash?: string;
    label?: string;
    pin?: string;
  };
  const hash = String(body.hash ?? "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hash)) {
    return Response.json({ error: "invalid device" }, { status: 400 });
  }

  if (body.action === "approve") {
    if (!pinMatches(body.pin)) {
      return Response.json({ error: "Incorrect PIN — device not approved." }, { status: 401 });
    }
    const ok = await approveDevice(hash, body.label);
    return ok
      ? Response.json({ ok: true })
      : Response.json({ error: "That device is no longer waiting." }, { status: 404 });
  }

  if (body.action === "remove") {
    if (hash === access.deviceHash) {
      return Response.json({ error: "The owner device cannot be removed." }, { status: 403 });
    }
    const ok = await removeDevice(hash);
    return ok
      ? Response.json({ ok: true })
      : Response.json({ error: "Device not found." }, { status: 404 });
  }

  return Response.json({ error: "action must be approve or remove" }, { status: 400 });
}
