'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { AlertTriangle, RefreshCw } from 'lucide-react';

/**
 * WidgetError — ditampilkan saat SWR fetch gagal.
 * User bisa retry dengan mutate().
 */
export function WidgetError({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="widget-card flex h-full min-h-[200px] flex-col items-center justify-center gap-3 rounded-2xl border border-red-500/10 bg-[linear-gradient(135deg,rgba(239,68,68,0.04),rgba(239,68,68,0.02))] p-5 shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10">
        <AlertTriangle className="h-6 w-6 text-red-500" strokeWidth={1.75} />
      </div>
      <p className="ts-sm font-semibold text-foreground">{message || 'Gagal memuat data'}</p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-card px-4 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/30 hover:text-primary"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Coba lagi
      </button>
    </div>
  );
}

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
