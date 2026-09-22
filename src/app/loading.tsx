import { PageSkeleton, SkeletonChart } from "@/components/skeleton";

/**
 * Dashboard. The most expensive page: it reads analytics, account and limits
 * together, and analytics is the endpoint that walks the whole window's fills.
 */
export default function Loading() {
  return (
    <PageSkeleton stats={5}>
      <div className="grid gap-6 xl:grid-cols-2">
        <SkeletonChart />
        <SkeletonChart />
      </div>
    </PageSkeleton>
  );
}
