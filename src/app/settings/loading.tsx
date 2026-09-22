import { PageSkeleton, SkeletonTable } from "@/components/skeleton";

/**
 * Settings reads one cheap endpoint (7 ms measured), so this is rarely seen.
 *
 * It exists anyway, because the alternative is not "no skeleton" — it is the
 * PREVIOUS page frozen on screen. Without a boundary here, clicking Settings
 * while the dashboard is still loading shows the dashboard, motionless, until
 * the dashboard finishes. The cost of the cheap page is paid by whatever
 * expensive page the reader is leaving.
 */
export default function Loading() {
  return (
    <PageSkeleton stats={0}>
      <div className="space-y-6">
        <SkeletonTable rows={6} />
        <SkeletonTable rows={5} />
      </div>
    </PageSkeleton>
  );
}
