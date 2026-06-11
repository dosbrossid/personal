'use client';

import { Skeleton } from '@/components/ui/skeleton';

/**
 * PageSkeleton — loading state seragam selevel halaman dashboard.
 * Menyerupai struktur umum halaman: header (judul + aksi), baris stat card,
 * lalu area konten. Menggantikan spinner full-screen generik agar perceived
 * performance lebih baik dan layout tidak melonjak (CLS rendah).
 */
export function PageSkeleton({
  statCount = 4,
  showStats = true,
  contentRows = 4,
}: {
  statCount?: number;
  showStats?: boolean;
  contentRows?: number;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="hidden h-10 w-32 rounded-xl lg:block" />
      </div>

      {/* Stat cards */}
      {showStats && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: statCount }).map((_, i) => (
            <Skeleton key={i} className="h-[92px] rounded-2xl" />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="space-y-3 rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
        {Array.from({ length: contentRows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
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
