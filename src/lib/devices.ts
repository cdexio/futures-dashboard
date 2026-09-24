import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

/**
 * Which browsers may open this dashboard at all.
 *
 * WHY A DEVICE COOKIE, NOT AN IP OR A UDID. A browser cannot read a UDID —
 * no web page can, by design. An IP is not a device: a phone changes it every
 * time it moves between Wi-Fi and mobile data, and a carrier puts thousands of
 * phones behind one address, so an IP lock both locks the owner out and lets
 * strangers in. What a browser CAN hold is a random secret the server gave it:
 * `cdx_device`, 256 bits, HttpOnly so no script can read it, issued by the
 * middleware on the first visit and kept for the cookie maximum of 400 days.
 *
 * ONLY THE HASH LEAVES THE BROWSER. The registry, the env file and the screen
 * all show SHA-256 of the cookie, never the cookie. The hash is what the owner
 * reads off the /device page and sends to be locked in, and having it does not
 * let anybody become that device.
 *
 * THE OWNER IS NOT IN THE FILE. `OWNER_DEVICE_HASH` lives in the environment,
 * so nothing reachable from the web — no route, no bug in one — can remove it.
 * Every other device lives in the JSON file below and can be approved and
 * removed from the owner's device.
 *
 * CLEARING SITE DATA FORGETS THE DEVICE. The cookie is the device; delete it
 * and the browser is new. For the owner that means sending the new hash to be
 * set in the environment again — the price of the lock not being removable.
 */

export const DEVICE_COOKIE = "cdx_device";
export const DEVICE_HEADER = "x-cdx-device";

const FILE = process.env.DEVICES_FILE ?? join(process.cwd(), "data", "devices.json");

/** Pending requests kept at most. Each is one sign-in from a new browser by an
 *  allow-listed account; a cap keeps a looping script from growing the file. */
const MAX_PENDING = 20;

/** `lastSeen` is rewritten at most this often, so a heartbeat every minute is
 *  not a disk write every minute. */
const SEEN_WRITE_MS = 5 * 60 * 1000;

export type DeviceRecord = {
  hash: string;
  label: string;
  userAgent: string;
  ip: string | null;
  addedAt: string;
  lastSeenAt: string | null;
};

type Registry = {
  devices: DeviceRecord[];
  pending: DeviceRecord[];
  /** Last contact for the owner, who is not in `devices`. */
  owner: { lastSeenAt: string | null; ip: string | null; userAgent: string };
};

export type DeviceView = DeviceRecord & { owner: boolean; current: boolean };

export function hashDevice(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function ownerHash(): string | null {
  const value = (process.env.OWNER_DEVICE_HASH ?? "").trim().toLowerCase();
  return /^[0-9a-f]{64}$/.test(value) ? value : null;
}

/** "iPhone · Safari" — enough to tell two devices apart in a list, not an
 *  attempt at a full user-agent parser. The raw string is kept beside it. */
export function describeAgent(ua: string): string {
  const os = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac OS X/.test(ua)
          ? "Mac"
          : /Windows/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Unknown";
  const browser = /EdgA?\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /CriOS|Chrome\//.test(ua)
        ? "Chrome"
        : /FxiOS|Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "Browser";
  return `${os} · ${browser}`;
}

function empty(): Registry {
  return { devices: [], pending: [], owner: { lastSeenAt: null, ip: null, userAgent: "" } };
}

async function load(): Promise<Registry> {
  try {
    const parsed = JSON.parse(await readFile(FILE, "utf8")) as Partial<Registry>;
    return { ...empty(), ...parsed };
  } catch (error) {
    // Missing is the first run. Anything else — a corrupt file — also reads
    // as empty, which FAILS CLOSED: every non-owner device needs approving
    // again, and the owner, who is not in the file, is unaffected.
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`devices: ${FILE} unreadable, treating as empty`, error);
    }
    return empty();
  }
}

// One writer at a time. Two requests read-modify-writing the file together
// would each write their own copy, and the second would erase the first's
// change — an approval that silently did not happen.
let queue: Promise<unknown> = Promise.resolve();

function mutate<T>(change: (registry: Registry) => T): Promise<T> {
  const run = queue.then(async () => {
    const registry = await load();
    const result = change(registry);
    await mkdir(dirname(FILE), { recursive: true });
    // Written beside and renamed over, so a crash mid-write leaves the old
    // file rather than half of the new one.
    const temporary = `${FILE}.tmp`;
    await writeFile(temporary, JSON.stringify(registry, null, 2), { mode: 0o600 });
    await rename(temporary, FILE);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

export type DeviceStatus = "owner" | "approved" | "unknown";

export async function deviceStatus(hash: string | null): Promise<DeviceStatus> {
  if (!hash) return "unknown";
  if (hash === ownerHash()) return "owner";
  const registry = await load();
  return registry.devices.some((device) => device.hash === hash) ? "approved" : "unknown";
}

/** Record a browser that signed in but is not approved, so it shows up on the
 *  owner's device waiting for a decision. */
export async function requestApproval(hash: string, userAgent: string, ip: string | null) {
  const now = new Date().toISOString();
  await mutate((registry) => {
    const existing = registry.pending.find((device) => device.hash === hash);
    if (existing) {
      if (Date.now() - Date.parse(existing.lastSeenAt ?? existing.addedAt) < SEEN_WRITE_MS) return;
      existing.lastSeenAt = now;
      existing.ip = ip;
      return;
    }
    registry.pending.unshift({
      hash,
      label: describeAgent(userAgent),
      userAgent,
      ip,
      addedAt: now,
      lastSeenAt: now,
    });
    registry.pending = registry.pending.slice(0, MAX_PENDING);
  });
}

export async function touchDevice(hash: string, userAgent: string, ip: string | null) {
  const registry = await load();
  const isOwner = hash === ownerHash();
  const record = isOwner ? registry.owner : registry.devices.find((device) => device.hash === hash);
  if (!record) return;
  if (record.lastSeenAt && Date.now() - Date.parse(record.lastSeenAt) < SEEN_WRITE_MS) return;
  await mutate((fresh) => {
    const target = isOwner ? fresh.owner : fresh.devices.find((device) => device.hash === hash);
    if (!target) return;
    target.lastSeenAt = new Date().toISOString();
    target.ip = ip;
    target.userAgent = userAgent;
  });
}

export async function listDevices(current: string | null): Promise<{
  devices: DeviceView[];
  pending: DeviceView[];
}> {
  const registry = await load();
  const owner = ownerHash();
  const devices: DeviceView[] = registry.devices.map((device) => ({
    ...device,
    owner: false,
    current: device.hash === current,
  }));
  if (owner) {
    devices.unshift({
      hash: owner,
      label: registry.owner.userAgent ? describeAgent(registry.owner.userAgent) : "Owner device",
      userAgent: registry.owner.userAgent,
      ip: registry.owner.ip,
      addedAt: "",
      lastSeenAt: registry.owner.lastSeenAt,
      owner: true,
      current: owner === current,
    });
  }
  // A request left over from before the device was set as owner, or approved
  // some other way, is not waiting for anything.
  const settled = new Set(devices.map((device) => device.hash));
  return {
    devices,
    pending: registry.pending
      .filter((device) => !settled.has(device.hash))
      .map((device) => ({ ...device, owner: false, current: false })),
  };
}

export async function approveDevice(hash: string, label?: string): Promise<boolean> {
  return mutate((registry) => {
    const index = registry.pending.findIndex((device) => device.hash === hash);
    if (index < 0) return false;
    const [device] = registry.pending.splice(index, 1);
    const name = label?.trim().slice(0, 40);
    registry.devices.push({ ...device, label: name || device.label, addedAt: new Date().toISOString() });
    return true;
  });
}

/** Remove an approved device or reject a pending one. The owner is not in the
 *  file, so there is nothing here that could remove it. */
export async function removeDevice(hash: string): Promise<boolean> {
  if (hash === ownerHash()) return false;
  return mutate((registry) => {
    const before = registry.devices.length + registry.pending.length;
    registry.devices = registry.devices.filter((device) => device.hash !== hash);
    registry.pending = registry.pending.filter((device) => device.hash !== hash);
    return registry.devices.length + registry.pending.length < before;
  });
}
