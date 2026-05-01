'use client';

import { useState, useTransition } from 'react';
import { mutate as mutateGlobal } from 'swr';
import { CheckSquare, Circle, CircleCheck, CircleDot, ArrowUpRight, Loader2, Plus, CalendarClock } from 'lucide-react';
import { toast } from 'sonner';
import { cn, getDateKeyInTimezone } from '@/lib/utils';
import { useTasks } from '@/hooks/use-tasks';
import { useCalendarEvents } from '@/hooks/use-calendar';
import { useUser } from '@/hooks/use-user';
import { createTask, updateTask } from '@/actions/tasks.actions';
import { PRIORITIES, ROLES } from '@/core/constants';
import type { Task } from '@/core/types';
import Link from 'next/link';

const statusIcons = {
  todo: Circle,
  in_progress: CircleDot,
  done: CircleCheck,
};

export function WidgetTasks() {
  const { tasks, isLoading, mutate } = useTasks();
  const { events } = useCalendarEvents();
  const { user } = useUser();
  const timezone = user?.preferences?.timezone || 'Asia/Jakarta';
  const todayKey = getDateKeyInTimezone(new Date(), timezone);
  const [title, setTitle] = useState('');
  const [isSaving, startSaving] = useTransition();
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const activeTasks = tasks
    .filter((task) => task.status !== 'done')
    .sort((a, b) => {
      const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
      if (a.due_date) return -1;
      if (b.due_date) return 1;
      return 0;
    });

  const urgentTasks = activeTasks.filter((task) => task.priority === 'urgent');
  const dueTodayTasks = activeTasks.filter((task) => task.due_date === todayKey);
  const upcomingTasks = activeTasks.filter((task) => task.priority !== 'urgent' && task.due_date !== todayKey);
  const spotlightTasks = [...urgentTasks, ...dueTodayTasks.filter((task) => task.priority !== 'urgent'), ...upcomingTasks]
    .filter((task, index, array) => array.findIndex((candidate) => candidate.id === task.id) === index)
    .slice(0, 5);

  const completionRate = tasks.length > 0
    ? Math.round((tasks.filter((task) => task.status === 'done').length / tasks.length) * 100)
    : 0;

  const matchingEventDates = new Set(
    events.map((event) => getDateKeyInTimezone(event.start_at, timezone))
  );

  async function handleQuickCreate() {
    if (!title.trim()) {
      toast.error('Judul task wajib diisi');
      return;
    }

    startSaving(async () => {
      const result = await createTask({
        title: title.trim(),
        priority: 'medium',
        contextual_role: 'general',
        status: 'todo',
      });

      if (result.error) {
        toast.error(result.error);
        return;
      }

      toast.success(`"${title.trim()}" berhasil dibuat`);
      setTitle('');
      mutate();
      mutateGlobal((key: unknown) => typeof key === 'string' && key.startsWith('/api/dashboard'));
    });
  }

  async function handleToggleTask(task: Task) {
    setTogglingId(task.id);
    const nextStatus = task.status === 'done' ? 'todo' : 'done';
    const result = await updateTask(task.id, { status: nextStatus });
    setTogglingId(null);

    if (result.error) {
      toast.error(result.error);
      return;
    }

    toast.success(nextStatus === 'done' ? `"${task.title}" selesai` : `"${task.title}" dibuka lagi`);
    mutate();
    mutateGlobal((key: unknown) => typeof key === 'string' && key.startsWith('/api/dashboard'));
    mutateGlobal((key: unknown) => typeof key === 'string' && key.startsWith('/api/notifications'));
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
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 dark:text-emerald-400">
            <CheckSquare className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="text-[16px] font-semibold text-foreground">Tugas</h2>
            <p className="text-[12px] text-muted-foreground">
              {activeTasks.length} aktif, {dueTodayTasks.length} due hari ini
            </p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {completionRate}% selesai
        </span>
      </div>

      <div className="mb-4 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Urgent</p>
            <p className="mt-1 text-[24px] font-bold leading-none text-foreground">{urgentTasks.length}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Due Hari Ini</p>
            <p className="mt-1 text-[24px] font-bold leading-none text-foreground">{dueTodayTasks.length}</p>
          </div>
          <div>
            <p className="text-[11px] font-medium text-muted-foreground">Upcoming</p>
            <p className="mt-1 text-[24px] font-bold leading-none text-foreground">{upcomingTasks.length}</p>
          </div>
        </div>
      </div>

      <div className="mb-4 rounded-xl border border-border/60 bg-muted/20 p-3">
        <div className="flex items-center gap-2">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void handleQuickCreate();
              }
            }}
            placeholder="Tambah task cepat..."
            className="h-9 flex-1 rounded-lg border border-border/60 bg-background px-3 text-[13px] text-foreground outline-none focus:ring-2 focus:ring-primary/10"
          />
          <button
            onClick={() => void handleQuickCreate()}
            disabled={isSaving}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[12px] font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Simpan
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {spotlightTasks.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
            <p className="text-[13px] font-medium text-foreground">Belum ada tugas aktif</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Mulai dari task kecil dulu. Begitu task pertama dibuat, ritme dashboard langsung terasa.</p>
            <button
              onClick={() => setTitle('Task pertamaku')}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-2 text-[12px] font-medium text-primary transition-colors hover:bg-primary/15"
            >
              <Plus className="h-3.5 w-3.5" />
              Isi contoh cepat
            </button>
          </div>
        ) : spotlightTasks.map((task) => {
          const StatusIcon = statusIcons[task.status];
          const priority = PRIORITIES[task.priority];
          const dueDateHasEvent = Boolean(task.due_date && matchingEventDates.has(task.due_date));

          return (
            <div
              key={task.id}
              className="group flex items-start gap-3 rounded-xl p-3 transition-all duration-200 hover:bg-muted/50"
            >
              <button
                onClick={() => void handleToggleTask(task)}
                disabled={togglingId === task.id}
                className="mt-0.5 shrink-0"
              >
                {togglingId === task.id ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                ) : (
                  <StatusIcon
                    className={cn(
                      'h-5 w-5 transition-colors',
                      task.status === 'done'
                        ? 'text-emerald-500'
                        : 'text-muted-foreground/40 group-hover:text-muted-foreground/60'
                    )}
                    strokeWidth={1.5}
                  />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[14px] font-medium text-foreground">{task.title}</p>
                  {task.priority === 'urgent' && (
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-500">
                      Urgent
                    </span>
                  )}
                  {task.due_date === todayKey && (
                    <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                      Hari ini
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={cn('text-[11px] px-2 py-0.5 rounded-full font-medium', ROLES[task.contextual_role].bgClass)}>
                    {ROLES[task.contextual_role].label}
                  </span>
                  {task.due_date && (
                    <span className="text-[11px] text-muted-foreground">
                      {new Date(task.due_date).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  {dueDateHasEvent && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                      <CalendarClock className="h-3 w-3" />
                      Ada agenda di hari yang sama
                    </span>
                  )}
                </div>
              </div>

              <div
                className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: priority.color, boxShadow: `0 0 8px ${priority.color}40` }}
              />
            </div>
          );
        })}
      </div>

      <Link
        href="/tasks"
        className="group mt-4 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 py-2.5 text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
      >
        Lihat Semua Tugas
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </div>
  );
}
