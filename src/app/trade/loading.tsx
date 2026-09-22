import { PageSkeleton, SkeletonTable } from "@/components/skeleton";

/**
 * Trade: open positions on the left, the activity feed on the right.
 *
 * This page seeds two client components that then poll on their own, so the
 * skeleton only has to cover the FIRST render — but that first render is the
 * one that reads the account, the limits, today's analytics and the activity
 * log, four upstream calls before anything paints.
 */
export default function Loading() {
  return (
    <PageSkeleton stats={0}>
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <SkeletonTable rows={4} />
        <SkeletonTable rows={8} />
      </div>
    </PageSkeleton>
  );
}
