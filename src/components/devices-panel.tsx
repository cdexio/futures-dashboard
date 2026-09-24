"use client";

import { useCallback, useEffect, useState } from "react";
import { Lock, Trash2 } from "lucide-react";

import { Badge, EmptyState } from "@/components/ui";

type Device = {
  hash: string;
  label: string;
  ip: string | null;
  addedAt: string;
  lastSeenAt: string | null;
  owner: boolean;
  current: boolean;
};

type DeviceList = { devices: Device[]; pending: Device[]; canManage: boolean };

function when(iso: string | null) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const short = (hash: string) => `${hash.slice(0, 8)}…${hash.slice(-4)}`;

/**
 * Which browsers can open the dashboard.
 *
 * The owner row has no remove button — not a disabled one, none. It is set
 * in the server's environment and nothing on this page could remove it.
 * Approving asks for the PIN; removing does not (see src/app/api/devices).
 */
export function DevicesPanel() {
  const [list, setList] = useState<DeviceList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [approving, setApproving] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch("/api/devices", { cache: "no-store" }).catch(() => null);
    if (!response?.ok) {
      setError("Could not load the device list.");
      return;
    }
    setList((await response.json()) as DeviceList);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(action: "approve" | "remove", hash: string) {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/devices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action, hash, pin, label }),
    }).catch(() => null);
    const body = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
    setBusy(false);
    if (!response?.ok) {
      setError(body?.error ?? "The server did not answer.");
      setPin("");
      return;
    }
    setApproving(null);
    setPin("");
    setLabel("");
    await load();
  }

  if (!list) {
    return error ? <p className="text-sm text-[var(--color-loss)]">{error}</p> : <div className="h-24" />;
  }

  return (
    <div className="space-y-6">
      {!list.canManage && (
        <p className="text-[var(--color-ink-muted)] text-xs">Managed from the owner device.</p>
      )}

      <ul className="divide-y divide-[var(--color-border)]/60">
        {list.devices.map((device) => (
          <li key={device.hash} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 text-sm font-medium">
                {device.label}
                {device.owner && <Badge intent="good">Owner</Badge>}
                {device.current && <Badge>This device</Badge>}
              </div>
              <div className="text-[var(--color-ink-muted)] tabular mt-1 text-xs">
                {short(device.hash)} · last seen {when(device.lastSeenAt)}
                {device.ip ? ` · ${device.ip}` : ""}
              </div>
            </div>
            {device.owner ? (
              <Lock className="text-[var(--color-ink-muted)] h-4 w-4 shrink-0" aria-label="Locked" />
            ) : (
              list.canManage && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`Remove ${device.label}? It will need approving again.`)) {
                      void act("remove", device.hash);
                    }
                  }}
                  className="text-[var(--color-ink-muted)] shrink-0 rounded-lg p-2 hover:text-[var(--color-loss)]"
                  aria-label={`Remove ${device.label}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )
            )}
          </li>
        ))}
      </ul>

      {list.canManage && (
        <div>
          <div className="text-[var(--color-ink-secondary)] mb-2 text-xs font-medium tracking-wide uppercase">
            Waiting for approval
          </div>
          {list.pending.length === 0 ? (
            <EmptyState title="No devices waiting" />
          ) : (
            <ul className="divide-y divide-[var(--color-border)]/60">
              {list.pending.map((device) => (
                <li key={device.hash} className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-sm font-medium">{device.label}</div>
                      <div className="text-[var(--color-ink-muted)] tabular mt-1 text-xs">
                        {short(device.hash)} · {when(device.lastSeenAt)}
                        {device.ip ? ` · ${device.ip}` : ""}
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void act("remove", device.hash)}
                        className="rounded-lg border border-[var(--color-border-strong)] px-3 py-1.5 text-xs"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setApproving(approving === device.hash ? null : device.hash);
                          setPin("");
                          setLabel("");
                          setError(null);
                        }}
                        className="rounded-lg border border-[var(--color-mint-dim)] px-3 py-1.5 text-xs text-[var(--color-mint)]"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                  {approving === device.hash && (
                    <form
                      className="mt-3 flex flex-wrap gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void act("approve", device.hash);
                      }}
                    >
                      <input
                        value={label}
                        onChange={(event) => setLabel(event.target.value)}
                        placeholder={`Name (${device.label})`}
                        maxLength={40}
                        className="min-w-0 flex-1 rounded-lg border bg-[var(--color-surface-raised)] px-3 py-2 text-sm"
                      />
                      <input
                        value={pin}
                        onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
                        type="password"
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="PIN"
                        className="tabular w-28 rounded-lg border bg-[var(--color-surface-raised)] px-3 py-2 text-sm"
                      />
                      <button
                        type="submit"
                        disabled={busy || pin.length === 0}
                        className="rounded-lg bg-[var(--color-mint)] px-4 py-2 text-sm font-semibold text-black disabled:opacity-50"
                      >
                        Confirm
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {error && <p className="text-sm text-[var(--color-loss)]">{error}</p>}
    </div>
  );
}
