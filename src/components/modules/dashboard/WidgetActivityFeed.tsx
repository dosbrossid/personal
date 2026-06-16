'use client';

import { useState } from 'react';
import { Activity, ChevronLeft, ChevronRight } from 'lucide-react';
import { useDashboardActivity } from '@/hooks/use-dashboard-activity';
import { formatRelativeTime } from '@/lib/utils';
import { WidgetSkeleton } from '@/components/modules/dashboard/WidgetSkeleton';
import { WidgetError } from '@/components/modules/dashboard/WidgetSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';

export function WidgetActivityFeed() {
  const [page, setPage] = useState(1);
  const { items, isLoading, isError, error, hasMore, mutate } = useDashboardActivity({ page, limit: 5 });

  if (isLoading) {
    return <WidgetSkeleton rows={5} showStats={false} />;
  }

  if (isError) {
    return <WidgetError message={error?.message || 'Gagal memuat aktivitas'} onRetry={() => mutate()} />;
  }

  return (
    <div className="widget-card rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/10 text-sky-500 dark:text-sky-400">
            <Activity className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="ts-title text-foreground">Aktivitas Terbaru</h2>
            <p className="text-[12px] text-muted-foreground">{items.length} item per halaman</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Live pulse
        </span>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <EmptyState
            title="Belum ada aktivitas tercatat"
            description="Begitu kamu membuat atau mengubah data, jejaknya akan muncul di sini."
          />
        ) : items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted/40">
            <div className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.35)]" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-foreground">{item.title}</p>
              <div className="mt-1 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">{item.description}</span>
                <span className="shrink-0 text-[11px] text-muted-foreground/70">{formatRelativeTime(item.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-border/60 bg-muted/20 px-3 py-2.5 text-[12px] text-muted-foreground">
        Feed ini terbarui otomatis tiap 1 menit untuk memberi gambaran ritme kerja tanpa perlu buka modul satu per satu.
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-[12px] text-muted-foreground">Halaman {page}</p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={page === 1 || isLoading}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border/60 bg-background px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
            Sebelumnya
          </button>
          <button
            onClick={() => setPage((current) => current + 1)}
            disabled={!hasMore || isLoading}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-border/60 bg-background px-3 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/20 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            Berikutnya
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
