import { HeaderBand, PageContainer } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Instant navigation fallbacks for `loading.tsx` (prefetched with the route's App Shell), so a click
 * shows the next page's frame at once while its data streams in.
 */
export function PageSkeleton() {
  return (
    <PageContainer className="space-y-5">
      <Skeleton className="h-8 w-56" />
      <div className="flex gap-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-32" />
        <Skeleton className="hidden h-10 w-32 md:block" />
      </div>
      <div className="space-y-2 rounded-lg border bg-card p-4 shadow-card">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    </PageContainer>
  );
}

/** Beranda / Laporan: the photo band, a row of five KPI tiles and two rows of cards. */
export function DashboardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <HeaderBand compact={compact}>
        <Skeleton className="h-8 w-40 bg-white/25" />
        <Skeleton className="mt-2 h-4 w-56 bg-white/20" />
      </HeaderBand>
      <PageContainer className="space-y-5">
        <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:mx-0 md:grid md:grid-cols-3 md:px-0 xl:grid-cols-5">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-28 min-w-[200px] rounded-lg md:min-w-0" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-lg" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Skeleton className="h-72 rounded-lg" />
          <Skeleton className="h-72 rounded-lg" />
        </div>
      </PageContainer>
    </>
  );
}
