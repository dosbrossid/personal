'use client';

import { useTransition } from 'react';
import { Bell, AlertCircle, CheckCircle2, ArrowUpRight, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';
import { markAllNotificationsSent } from '@/actions/notifications.actions';
import { cn } from '@/lib/utils';
import { useNotifications } from '@/hooks/use-notifications';
import { formatRelativeTime } from '@/lib/utils';
import { WidgetSkeleton } from '@/components/modules/dashboard/WidgetSkeleton';
import { WidgetError } from '@/components/modules/dashboard/WidgetSkeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import Link from 'next/link';


export function WidgetNotifications() {
  const { notifications: allNotifications, isLoading, isError, error, mutate } = useNotifications();
  const [isMarking, startMarking] = useTransition();

  const notifications = allNotifications.slice(0, 4);
  const pendingCount = allNotifications.filter(n => n.status === 'pending').length;

  const handleMarkAllRead = () => {
    if (pendingCount === 0 || isMarking) return;

    startMarking(async () => {
      const result = await markAllNotificationsSent();

      if (result.error) {
        toast.error(result.error);
        mutate();
        return;
      }

      toast.success(`${result.data?.updated ?? 0} notifikasi ditandai selesai`);
      mutate();
    });
  };

  if (isLoading) {
    return <WidgetSkeleton rows={4} showStats={false} />;
  }

  if (isError) {
    return <WidgetError message={error?.message || 'Gagal memuat notifikasi'} onRetry={() => mutate()} />;
  }

  return (
    <div className="widget-card rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 text-rose-500 dark:text-rose-400">
            <Bell className="h-5 w-5" strokeWidth={2} />
            {pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.4)]">
                {pendingCount}
              </span>
            )}
          </div>
          <div>
            <h2 className="ts-title text-foreground">Notifikasi</h2>
            <p className="text-[12px] text-muted-foreground">{notifications.length} notifikasi terbaru</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMarkAllRead}
            disabled={pendingCount === 0 || isMarking}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-200 disabled:pointer-events-none disabled:opacity-40"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            {isMarking ? 'Menyimpan...' : 'Mark All Read'}
          </button>
          <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
            {pendingCount} pending
          </span>
        </div>
      </div>

      {/* ─── Notifications List ─── */}
      <div className="space-y-2">
        {notifications.length === 0 ? (
          <EmptyState
            title="Belum ada notifikasi"
            description="Notifikasi baru akan muncul di sini."
          />
        ) : notifications.map((notif) => (
          <div
            key={notif.id}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer group',
              notif.status === 'pending'
                ? 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06] border-l-[3px] border-l-amber-500'
                : 'hover:bg-muted/50 border-l-[3px] border-l-transparent'
            )}
          >
            {/* Status Icon */}
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all duration-200",
              notif.status === 'pending'
                ? "bg-amber-500/10 text-amber-500 dark:text-amber-400"
                : "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400"
            )}>
              {notif.status === 'pending' 
                ? <AlertCircle className="h-5 w-5" /> 
                : <CheckCircle2 className="h-5 w-5" />
              }
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className={cn(
                'text-[14px] font-medium truncate',
                notif.status === 'pending' ? 'text-foreground' : 'text-muted-foreground'
              )}>
                {notif.body}
              </p>
              <div className="flex items-center gap-3 mt-1">
                <span className={cn(
                  'text-[12px] font-medium',
                  notif.channel === 'telegram' ? 'text-blue-500' : 'text-muted-foreground'
                )}>
                  {notif.channel === 'telegram' ? '📱 Telegram' : '🔔 Push'}
                </span>
                <span className="text-[12px] text-muted-foreground/60">
                  {formatRelativeTime(notif.scheduled_at ?? notif.created_at)}
                </span>
              </div>
            </div>

            {/* Status Badge */}
            <span className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0 transition-all duration-200",
              notif.status === 'pending'
                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            )}>
              <span className={cn(
                "h-1.5 w-1.5 rounded-full",
                notif.status === 'pending'
                  ? "bg-amber-500 shadow-[0_0_4px_rgba(245,158,11,0.5)]"
                  : "bg-emerald-500 shadow-[0_0_4px_rgba(16,185,129,0.5)]"
              )} />
              {notif.status === 'pending' ? 'Pending' : 'Sent'}
            </span>
          </div>
        ))}
      </div>

      {/* ─── Footer ─── */}
      <Link
        href="/settings"
        className="flex items-center justify-center gap-1.5 w-full mt-4 py-2.5 rounded-xl border border-border/60 bg-muted/30 text-[13px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group"
      >
        Kelola Notifikasi
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </div>
  );
}
