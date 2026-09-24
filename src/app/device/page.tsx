import { MonitorSmartphone } from "lucide-react";

import { signOutAction } from "@/app/actions";
import { BrandMark } from "@/components/brand-mark";
import { DeviceCode } from "@/components/device-code";
import { getAccess } from "@/lib/access";
import { describeAgent, ownerHash } from "@/lib/devices";
import { headers } from "next/headers";

/**
 * A signed-in browser that is not the owner's and has not been approved.
 *
 * It shows the device's FINGERPRINT — SHA-256 of its cookie — and nothing
 * else about the account. The fingerprint is safe to copy into a chat: it is
 * how a device is named, not how one is impersonated.
 *
 * With no owner configured yet this is also the setup screen: the owner opens
 * the dashboard on their own phone, copies the code shown here, and it goes
 * into `OWNER_DEVICE_HASH`.
 */
export default async function DevicePage() {
  const access = await getAccess();
  const agent = describeAgent((await headers()).get("user-agent") ?? "");
  const configured = ownerHash() !== null;

  return (
    <main className="relative z-10 grid min-h-screen place-items-center px-6">
      <div className="glass ring-solana w-full max-w-md rounded-3xl p-8 sm:p-10">
        <BrandMark subtitle="Security" />

        <div className="mt-8 flex items-center gap-2 text-[var(--color-warning)]">
          <MonitorSmartphone className="h-4 w-4" />
          <span className="text-xs font-medium tracking-wide uppercase">Device not approved</span>
        </div>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          {configured ? "Waiting for approval" : "Set the owner device"}
        </h1>
        <p className="text-[var(--color-ink-secondary)] mt-2 text-sm">
          {configured ? "Approve from the owner device: Settings → Devices." : "Send this code to set the owner device."}
        </p>

        <div className="mt-6 text-xs text-[var(--color-ink-muted)]">
          {agent} · {access.email}
        </div>
        {access.deviceHash ? (
          <DeviceCode hash={access.deviceHash} />
        ) : (
          <p className="mt-3 text-sm text-[var(--color-loss)]">
            Cookies are blocked. Enable them and reload.
          </p>
        )}

        <form action={signOutAction} className="mt-8 text-center">
          <button type="submit" className="text-[var(--color-ink-muted)] text-xs hover:text-[var(--color-loss)]">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
