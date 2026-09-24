import Image from "next/image";
import clsx from "clsx";

/**
 * The CDEXIO icon — the same artwork as the favicon and the home-screen icon
 * (public/icons, built by deploy/gen-icons.mjs), so the app looks like one
 * thing from the phone's home screen to the sidebar.
 */
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <Image
      src="/icons/icon-192.png"
      alt="CDEXIO"
      width={size}
      height={size}
      priority
      className={clsx("ring-solana shrink-0 object-cover", className ?? "rounded-xl")}
    />
  );
}

export function BrandMark({ subtitle = "Futures Agent" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <LogoMark size={48} className="rounded-2xl" />
      <div>
        <div className="text-xl leading-none font-semibold tracking-tight">CDEXIO</div>
        <div className="text-[var(--color-ink-muted)] mt-1.5 text-[11px] tracking-[0.18em] uppercase">
          {subtitle}
        </div>
      </div>
    </div>
  );
}
