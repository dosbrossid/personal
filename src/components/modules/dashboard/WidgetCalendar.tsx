'use client';

import { addDays } from 'date-fns';
import { CalendarDays, Clock, ArrowUpRight } from 'lucide-react';
import { cn, getDateKeyInTimezone, getTimeInTimezone } from '@/lib/utils';
import { useCalendarEvents } from '@/hooks/use-calendar';
import { useUser } from '@/hooks/use-user';
import { ROLES } from '@/core/constants';
import Link from 'next/link';
const roleColors: Record<string, string> = {
  dosen: 'border-l-blue-500',
  creator: 'border-l-amber-500',
  affiliate: 'border-l-pink-500',
  consultant: 'border-l-emerald-500',
  general: 'border-l-violet-500',
};

function getReminderLabel(reminderMinutes: number | null) {
  if (reminderMinutes === null || reminderMinutes === undefined) return null;
  if (reminderMinutes === 0) return 'Saat mulai';
  return `${reminderMinutes}m`;
}

export function WidgetCalendar() {
  const { events, isLoading } = useCalendarEvents();
  const { user } = useUser();
  const timezone = user?.preferences?.timezone || 'Asia/Jakarta';

  const todayStr = getDateKeyInTimezone(new Date(), timezone);
  const now = new Date();
  const tomorrowStr = getDateKeyInTimezone(addDays(now, 1), timezone);
  const upcomingEvents = [...events]
    .filter((event) => {
      const startAt = new Date(event.start_at);
      const endAt = event.end_at ? new Date(event.end_at) : null;

      if (endAt) {
        return endAt.getTime() >= now.getTime();
      }

      return startAt.getTime() >= now.getTime();
    })
    .sort((a, b) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
    .slice(0, 5);
  const ongoingCount = events.filter((event) => {
    const startAt = new Date(event.start_at);
    const endAt = event.end_at ? new Date(event.end_at) : null;

    return startAt.getTime() <= now.getTime() && Boolean(endAt && endAt.getTime() >= now.getTime());
  }).length;
  const todayCount = events.filter((event) => getDateKeyInTimezone(event.start_at, timezone) === todayStr).length;
  const tomorrowCount = events.filter((event) => getDateKeyInTimezone(event.start_at, timezone) === tomorrowStr).length;

  function getUpcomingLabel(startAtValue: string, endAtValue: string | null) {
    const startAt = new Date(startAtValue);
    const endAt = endAtValue ? new Date(endAtValue) : null;
    const dateKey = getDateKeyInTimezone(startAt, timezone);

    if (startAt.getTime() <= now.getTime() && endAt && endAt.getTime() >= now.getTime()) {
      return 'Sedang berlangsung';
    }

    if (dateKey === todayStr) return 'Hari ini';
    if (dateKey === tomorrowStr) return 'Besok';

    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      timeZone: timezone,
    }).format(startAt);
  }

  if (isLoading) {
    return (
      <div className="widget-card rounded-2xl border border-border/60 bg-card p-5 shadow-sm h-full flex items-center justify-center min-h-[300px]">
        <div className="animate-pulse flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted"></div>
          <div className="h-4 w-24 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="widget-card rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      {/* ─── Header ─── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 dark:text-amber-400">
            <CalendarDays className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">Agenda</h2>
            <p className="text-[12px] text-muted-foreground">{upcomingEvents.length} event terdekat</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          Upcoming
        </span>
      </div>

      <div className="mb-4 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Sedang Jalan</p>
            <p className="mt-1 text-[24px] font-bold leading-none text-foreground">{ongoingCount}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Hari Ini</p>
            <p className="mt-1 text-[24px] font-bold leading-none text-foreground">{todayCount}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Besok</p>
            <p className="mt-1 text-[24px] font-bold leading-none text-foreground">{tomorrowCount}</p>
          </div>
        </div>
      </div>

      {/* ─── "Now" indicator ─── */}
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)] animate-pulse" />
        <div className="flex-1 h-px bg-red-500/30" />
        <span className="text-[10px] font-semibold text-red-500 tabular-nums">
          {getTimeInTimezone(now, timezone)} Sekarang
        </span>
      </div>

      {/* ─── Events List ─── */}
      <div className="space-y-2">
        {upcomingEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
            <p className="text-[13px] font-medium text-foreground">Belum ada upcoming event</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Event terdekatmu akan muncul di sini begitu jadwal baru dibuat.</p>
          </div>
        ) : upcomingEvents.map((event, index) => {
          const isOngoing =
            new Date(event.start_at).getTime() <= now.getTime() &&
            Boolean(event.end_at && new Date(event.end_at).getTime() >= now.getTime());
          const colorClass = roleColors[event.contextual_role] || 'border-l-emerald-500';

          return (
            <div
              key={event.id}
              className={cn(
                'flex items-start gap-3 p-3 rounded-xl transition-all duration-200 cursor-pointer group relative border border-transparent',
                isOngoing
                  ? 'bg-[linear-gradient(135deg,rgba(16,185,129,0.08),rgba(59,130,246,0.06))] border-emerald-500/20'
                  : 'bg-muted/25 hover:bg-muted/50 hover:border-border/60'
              )}
            >
              {/* Timeline connector */}
              {index < upcomingEvents.length - 1 && (
                <div className="absolute left-[37px] top-[48px] bottom-[-12px] w-px border-l border-dashed border-border/60" />
              )}

              <div className="flex flex-col items-center shrink-0 w-12 pt-1 relative z-10">
                <span className="text-[14px] font-bold text-foreground tabular-nums">
                  {getTimeInTimezone(event.start_at, timezone)}
                </span>
                {event.end_at && (
                  <span className="text-[11px] font-medium text-muted-foreground tabular-nums">
                    {getTimeInTimezone(event.end_at, timezone)}
                  </span>
                )}
              </div>

              <div className={cn(
                'flex-1 min-w-0 border-l-[3px] pl-3 py-1 rounded-r-lg transition-all duration-200',
                colorClass,
                'group-hover:bg-muted/30 group-hover:px-3'
              )}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-medium text-foreground truncate">
                    {event.title}
                  </p>
                  <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">
                    {getUpcomingLabel(event.start_at, event.end_at)}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', ROLES[event.contextual_role].bgClass)}>
                    {ROLES[event.contextual_role].label}
                  </span>
                  {getReminderLabel(event.reminder_minutes) && (
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      {getReminderLabel(event.reminder_minutes)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Footer ─── */}
      <Link
        href="/calendar"
        className="flex items-center justify-center gap-1.5 w-full mt-4 py-2.5 rounded-xl border border-border/60 bg-muted/30 text-[13px] font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/30 transition-all duration-200 group"
      >
        Buka Kalender
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </div>
  );
}
