'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * Skeleton loading state seragam untuk semua widget dashboard.
 * Menyerupai struktur widget: header (ikon + judul + badge),
 * blok stat opsional, lalu deretan baris konten.
 */
export function WidgetSkeleton({
  rows = 3,
  showStats = true,
  showInput = false,
}: {
  rows?: number;
  showStats?: boolean;
  showInput?: boolean;
}) {
  return (
    <div className="widget-card h-full rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-6 w-20 rounded-full" />
      </div>

      {/* Stat block */}
      {showStats && (
        <div className="mb-4 grid grid-cols-3 gap-3 rounded-xl border border-border/60 bg-muted/20 p-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-3 w-12" />
              <Skeleton className="h-6 w-8" />
            </div>
          ))}
        </div>
      )}

      {/* Quick input */}
      {showInput && <Skeleton className="mb-4 h-14 w-full rounded-xl" />}

      {/* Rows */}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3">
            <Skeleton className="h-10 w-10 rounded-xl" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
