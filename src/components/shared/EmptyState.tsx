'use client';

import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * EmptyState — tampilan kosong seragam untuk widget & list dashboard.
 * Menyatukan pola dashed-border yang sebelumnya diduplikasi di tiap widget.
 *
 * Opsional: ikon di atas judul, dan satu action (tombol) di bawah deskripsi.
 */
export function EmptyState({
  title,
  description,
  icon: Icon,
  action,
  className,
  compact = false,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
  /** Padding lebih kecil untuk ruang sempit. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-border/70 bg-muted/20 text-center',
        compact ? 'p-4' : 'p-6',
        className
      )}
    >
      {Icon && (
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-muted/60 text-muted-foreground">
          <Icon className="h-5 w-5" strokeWidth={1.75} />
        </div>
      )}
      <p className="ts-sm font-medium text-foreground">{title}</p>
      {description && <p className="ts-caption mt-1 text-muted-foreground">{description}</p>}
      {action && <div className="mt-3 flex justify-center">{action}</div>}
    </div>
  );
}
