import { Card, CardContent, CardHeader } from '@project/components/ui/card';
import { Skeleton } from '@project/components/ui/skeleton';

export default function LeadsTableSkeleton() {
  return (
    <Card className="shadow-premium">
      {/* Toolbar skeleton */}
      <CardHeader className="pb-3 border-b border-border">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <Skeleton className="h-9 w-full sm:w-72" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-16" />
            <Skeleton className="h-9 w-20" />
          </div>
        </div>
        <Skeleton className="h-3 w-32 mt-1" />
      </CardHeader>

      <CardContent className="p-0">
        {/* Desktop skeleton rows */}
        <div className="hidden lg:block">
          {/* Header row */}
          <div className="flex items-center gap-4 px-4 py-2.5 bg-muted/40 border-b border-border">
            {[140, 96, 120, 100, 130, 110, 60].map((w, i) => (
              <Skeleton key={i} className="h-3" style={{ width: w }} />
            ))}
          </div>
          {/* Data rows */}
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3.5 border-b border-border last:border-0">
              <div className="space-y-1.5" style={{ width: 140 }}>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
              <div className="flex items-center gap-2" style={{ width: 120 }}>
                <Skeleton className="h-3.5 w-3.5 rounded" />
                <Skeleton className="h-3.5 w-24" />
              </div>
              <div className="flex items-center gap-2" style={{ width: 100 }}>
                <Skeleton className="h-3.5 w-3.5 rounded" />
                <Skeleton className="h-3.5 w-20" />
              </div>
              <div className="space-y-1.5" style={{ width: 130 }}>
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-20" />
              </div>
              <div className="space-y-1.5" style={{ width: 110 }}>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-8 w-16 rounded-md" />
            </div>
          ))}
        </div>

        {/* Mobile skeleton cards */}
        <div className="lg:hidden divide-y divide-border">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="p-4 space-y-3">
              <div className="flex justify-between items-start gap-3">
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-5 w-20 rounded-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
