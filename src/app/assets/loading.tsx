import { PageSkeleton, SkeletonTable } from "@/components/skeleton";

/** Assets: the wallet totals, then every movement in or out of it. */
export default function Loading() {
  return (
    <PageSkeleton stats={4}>
      <SkeletonTable rows={6} />
    </PageSkeleton>
  );
}
