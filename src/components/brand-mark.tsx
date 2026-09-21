import { BarChart3 } from "lucide-react";

export function BrandMark({ subtitle = "Futures Agent" }: { subtitle?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="ring-solana grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[var(--color-solana)] to-[var(--color-mint)]">
        <BarChart3 className="h-6 w-6 text-black" strokeWidth={2.5} />
      </div>
      <div>
        <div className="text-xl leading-none font-semibold tracking-tight">CDEXIO</div>
        <div className="text-[var(--color-ink-muted)] mt-1.5 text-[11px] tracking-[0.18em] uppercase">
          {subtitle}
        </div>
      </div>
    </div>
  );
}
