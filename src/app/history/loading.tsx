import { PageSkeleton, SkeletonTable } from "@/components/skeleton";

/** History: a few totals, then the table of closed round trips. */
export default function Loading() {
  return (
    <PageSkeleton stats={4}>
      <SkeletonTable rows={10} />
    </PageSkeleton>
  );
}
