'use client';

import { useTransition } from 'react';
import { Download, Calendar, CheckSquare, Brain, Flame, CalendarDays, Loader2 } from 'lucide-react';
import { WidgetTasks } from '@/components/modules/dashboard/WidgetTasks';
import { WidgetCalendar } from '@/components/modules/dashboard/WidgetCalendar';
import { WidgetHabits } from '@/components/modules/dashboard/WidgetHabits';
import { WidgetNotes } from '@/components/modules/dashboard/WidgetNotes';
import { WidgetNotifications } from '@/components/modules/dashboard/WidgetNotifications';
import { WidgetActivityFeed } from '@/components/modules/dashboard/WidgetActivityFeed';
import { useDashboardStats } from '@/hooks/use-dashboard-stats';
import { useUser } from '@/hooks/use-user';
import { toast } from 'sonner';

function getGreeting(timezone: string): { text: string; emoji: string } {
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      hour: 'numeric',
      hour12: false,
      timeZone: timezone,
    }).format(new Date())
  );
  if (hour < 5) return { text: 'Selamat Malam', emoji: '🌙' };
  if (hour < 11) return { text: 'Selamat Pagi', emoji: '☀️' };
  if (hour < 15) return { text: 'Selamat Siang', emoji: '🌤️' };
  if (hour < 18) return { text: 'Selamat Sore', emoji: '🌅' };
  return { text: 'Selamat Malam', emoji: '🌙' };
}

export default function DashboardPage() {
  const { stats, isLoading } = useDashboardStats();
  const { user, isLoading: isUserLoading } = useUser();
  const [isExporting, startExport] = useTransition();

  const timezone = user?.preferences?.timezone || 'Asia/Jakarta';
  const currentDate = new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: timezone,
  }).format(new Date());
  const greeting = getGreeting(timezone);
  const displayName = user?.full_name?.trim() || user?.email?.split('@')[0] || 'teman';

  const statCards = [
    {
      label: 'Tugas Aktif',
      value: stats?.activeTasks?.toString() || '0',
      sub: `${stats?.urgentTasks || 0} urgent`,
      icon: CheckSquare,
      gradient: 'gradient-emerald',
      glow: 'shadow-emerald-500/20',
    },
    {
      label: 'Habit Streak',
      value: `${stats?.habitCompletion || 0}%`,
      sub: 'hari ini',
      icon: Flame,
      gradient: 'gradient-violet',
      glow: 'shadow-violet-500/20',
    },
    {
      label: 'Catatan',
      value: stats?.totalNotes?.toString() || '0',
      sub: `${stats?.pinnedNotes || 0} pinned`,
      icon: Brain,
      gradient: 'gradient-blue',
      glow: 'shadow-blue-500/20',
    },
    {
      label: 'Agenda',
      value: stats?.todayEvents?.toString() || '0',
      sub: `${stats?.upcomingEvents || 0} mendatang`,
      icon: CalendarDays,
      gradient: 'gradient-amber',
      glow: 'shadow-amber-500/20',
    },
  ];

  async function handleExport() {
    startExport(async () => {
      try {
        const response = await fetch('/api/dashboard/export');

        if (!response.ok) {
          const data = await response.json().catch(() => ({ error: 'Gagal export dashboard' }));
          toast.error(data.error || 'Gagal export dashboard');
          return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `dashboard-export-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        window.URL.revokeObjectURL(url);
        toast.success('Export dashboard berhasil dibuat');
      } catch {
        toast.error('Gagal export dashboard');
      }
    });
  }

  if (isLoading || isUserLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Memuat dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ─── */}
      <div className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-3xl">
            <h1 className="flex flex-wrap items-center gap-2 text-[30px] font-bold tracking-tight text-foreground sm:text-[34px] lg:text-[28px]">
              <span>{greeting.text},</span>
              <span>{displayName}</span>
              <span className="text-[24px] sm:text-[26px]">{greeting.emoji}</span>
            </h1>
            <p className="mt-2 max-w-2xl text-[15px] leading-7 text-muted-foreground sm:text-[16px] lg:text-[14px]">
              Pantau produktivitas dan kelola semua peran profesionalmu hari ini.
            </p>
          </div>

          <div className="hidden items-center gap-3 lg:flex">
            <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-[13px] text-muted-foreground shadow-sm">
              <Calendar className="h-4 w-4" />
              <span>{currentDate}</span>
            </div>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-foreground to-foreground/90 px-4 py-2 text-[13px] font-medium text-background shadow-lg shadow-foreground/10 transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60"
            >
              {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span>{isExporting ? 'Mengekspor...' : 'Export'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_auto] lg:hidden">
          <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-card px-4 py-3 text-[13px] text-muted-foreground shadow-sm">
            <Calendar className="h-4 w-4 shrink-0" />
            <span className="leading-6">{currentDate}</span>
          </div>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="flex h-12 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-foreground to-foreground/90 px-4 text-[14px] font-medium text-background shadow-lg shadow-foreground/10 transition-all duration-200 hover:opacity-90 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-60"
          >
            {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            <span>{isExporting ? 'Mengekspor...' : 'Export dashboard'}</span>
          </button>
        </div>
      </div>

      {/* ─── Stat Summary Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`${card.gradient} rounded-2xl p-4 text-white shadow-lg ${card.glow} cursor-default relative overflow-hidden group hover:-translate-y-0.5 transition-transform duration-200`}
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[12px] font-medium text-white/70">{card.label}</p>
                <div className="h-8 w-8 rounded-lg bg-white/15 flex items-center justify-center backdrop-blur-sm">
                  <Icon className="h-4 w-4 text-white" strokeWidth={2} />
                </div>
              </div>
              <p className="text-[26px] font-bold leading-none">{card.value}</p>
              <p className="text-[11px] text-white/60 mt-1 font-medium">{card.sub}</p>
            </div>
          );
        })}
      </div>

      {/* ─── Bento Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div>
          <WidgetTasks />
        </div>
        <div>
          <WidgetCalendar />
        </div>
        <div>
          <WidgetHabits />
        </div>
        <div>
          <WidgetNotes />
        </div>
        <div className="lg:col-span-2">
          <WidgetNotifications />
        </div>
        <div className="lg:col-span-2">
          <WidgetActivityFeed />
        </div>
      </div>
    </div>
  );
}
