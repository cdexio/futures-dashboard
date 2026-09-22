/**
 * What a page shows while its numbers are still on their way.
 *
 * WHY THIS EXISTS AT ALL. Every page here is `dynamic = "force-dynamic"` and
 * reads the bot API on the server, and there was no `loading.tsx` anywhere.
 * In the App Router a navigation to a dynamic route WAITS for the server
 * render before it paints — so with no loading boundary the browser keeps
 * showing the PREVIOUS page, frozen, with no spinner and no change of any
 * kind, until the data arrives. Measured against the live API on 2026-09-22:
 * `analytics?days=30` took 7.4 seconds cold, `history?days=90` 5.1 seconds,
 * and when Binance's per-IP rate limit was exhausted the render failed
 * outright.
 *
 * Seven seconds of a frozen screen is not read as "loading". It is read as
 * "the button did nothing", which is exactly how the owner described the
 * dashboard: "mau pindah halaman saja tidak bisa."
 *
 * A `loading.tsx` per route turns that into an instant paint: Next sends the
 * shell and this skeleton immediately and streams the real page in behind it.
 * The nav stays live throughout, so a reader who clicked the wrong tab can
 * click another one instead of waiting for the first to finish.
 *
 * NO ANIMATION LIBRARY HERE, deliberately. This renders while the page's own
 * JavaScript is still being fetched, so it must be CSS only — a skeleton that
 * needed `motion` to appear would be blank for exactly the moment it exists
 * to cover.
 */

export function SkeletonBox({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-xl bg-white/5 ${className}`} />;
}

/** The heading block every page opens with. */
export function SkeletonHeader() {
  return (
    <div className="space-y-3">
      <SkeletonBox className="h-9 w-56" />
      <SkeletonBox className="h-4 w-80" />
    </div>
  );
}

/**
 * ONE stat card, with no grid around it.
 *
 * Separate from `SkeletonStats` because a Suspense island that fills two
 * cells of an existing grid must not bring its own grid: nesting one inside
 * another lays the placeholders out differently from the content that
 * replaces them, and the row visibly jumps when it arrives.
 */
export function SkeletonStatCard() {
  return (
    <div className="glass space-y-3 rounded-2xl p-5">
      <SkeletonBox className="h-3 w-24" />
      <SkeletonBox className="h-7 w-32" />
      <SkeletonBox className="h-3 w-20" />
    </div>
  );
}

/** A row of stat cards — the shape of the dashboard, assets and history tops. */
export function SkeletonStats({ count = 4 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </div>
  );
}

/** Stat-card placeholders WITHOUT a wrapper, for filling cells of a grid
 *  that already exists. */
export function SkeletonStatCells({ count = 2 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonStatCard key={i} />
      ))}
    </>
  );
}

/** A chart panel. */
export function SkeletonChart({ className = "h-72" }: { className?: string }) {
  return (
    <div className="glass rounded-2xl p-6">
      <SkeletonBox className="mb-5 h-4 w-40" />
      <SkeletonBox className={className} />
    </div>
  );
}

/** A table of rows, for the history and assets pages. */
export function SkeletonTable({ rows = 8 }: { rows?: number }) {
  return (
    <div className="glass space-y-3 rounded-2xl p-6">
      <SkeletonBox className="h-4 w-40" />
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonBox key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}

/**
 * The default page skeleton: a heading, some stats, a chart.
 *
 * Deliberately close to the real layout rather than a generic spinner. A
 * skeleton whose shape matches what arrives does not make the page jump when
 * the content replaces it, and the reader's eye is already in the right place.
 */
export function PageSkeleton({
  stats = 4,
  children,
}: {
  stats?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading the latest numbers from the trading machine</span>
      <SkeletonHeader />
      {stats > 0 && <SkeletonStats count={stats} />}
      {children ?? <SkeletonChart />}
    </div>
  );
}
