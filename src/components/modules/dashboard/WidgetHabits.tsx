'use client';

import { Flame, ArrowUpRight, TrendingUp } from 'lucide-react';
import { subDays } from 'date-fns';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { useHabits } from '@/hooks/use-habits';
import { ROLES } from '@/core/constants';
import { getHabitCadenceLabel, getHabitProgressSnapshot, isHabitCompletedOnDate, isHabitExpectedOnDate, isScheduledHabit } from '@/lib/habits';
import { WidgetSkeleton } from '@/components/modules/dashboard/WidgetSkeleton';

const dayLabels = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

const roleBarColors: Record<string, string> = {
  dosen: 'bg-blue-500',
  creator: 'bg-amber-500',
  affiliate: 'bg-pink-500',
  consultant: 'bg-emerald-500',
  general: 'bg-violet-500',
};

export function WidgetHabits() {
  const { habits, isLoading } = useHabits();
  const activeHabits = habits.filter((habit) => habit.is_active).slice(0, 3);

  const progressSnapshots = activeHabits
    .map((habit) => getHabitProgressSnapshot(habit, new Date()))
    .filter((snapshot) => snapshot.target > 0);
  const completionRate = progressSnapshots.length > 0
    ? Math.round(
        (progressSnapshots.reduce((total, snapshot) => total + snapshot.ratio, 0) / progressSnapshots.length) * 100
      )
    : 0;
  const totalCompleted = progressSnapshots.reduce((total, snapshot) => total + snapshot.completed, 0);

  if (isLoading) {
    return <WidgetSkeleton rows={3} showStats={false} />;
  }

  return (
    <div className="widget-card rounded-2xl border border-border/60 bg-card p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-500 dark:text-violet-400">
            <Flame className="h-5 w-5" strokeWidth={2} />
          </div>
          <div>
            <h2 className="ts-title text-foreground">Kebiasaan</h2>
            <p className="text-[12px] text-muted-foreground">{activeHabits.length} kebiasaan aktif</p>
          </div>
        </div>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
          {completionRate}% rate
        </span>
      </div>

      <div className="mb-5 rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[12px] font-medium text-muted-foreground">Progress Aktif</p>
            <p className="mt-0.5 text-[28px] font-bold text-foreground">{totalCompleted}</p>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-[12px] font-semibold text-muted-foreground shadow-sm ring-1 ring-border/60">
            <TrendingUp className="h-3 w-3" />
            {completionRate}% Rate
          </div>
        </div>
      </div>

      <div className="space-y-5">
        {activeHabits.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/70 bg-muted/20 p-6 text-center">
            <p className="text-[13px] font-medium text-foreground">Belum ada kebiasaan aktif</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Buat habit pertamamu untuk mulai melihat ritmenya di dashboard.</p>
          </div>
        ) : activeHabits.map((habit) => {
          const last7Days = Array.from({ length: 7 }, (_, index) => subDays(new Date(), 6 - index));
          const snapshot = getHabitProgressSnapshot(habit, new Date());
          const barColor = roleBarColors[habit.contextual_role] || 'bg-primary';

          return (
            <div key={habit.id} className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-[14px] font-medium text-foreground">{habit.name}</p>
                    <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', ROLES[habit.contextual_role].bgClass)}>
                      {ROLES[habit.contextual_role].icon}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{getHabitCadenceLabel(habit)}</p>
                </div>
                <span className="text-[12px] font-semibold tabular-nums text-muted-foreground">
                  {snapshot.target > 0 ? `${snapshot.completed}/${snapshot.target}` : 'off'}
                </span>
              </div>

              <div className="flex gap-1.5">
                {last7Days.map((day, index) => {
                  const isCompleted = isHabitCompletedOnDate(habit, day);
                  const isExpected = isScheduledHabit(habit) ? isHabitExpectedOnDate(habit, day) : true;

                  return (
                    <div key={day.toISOString()} className="flex flex-1 flex-col items-center gap-1">
                      <div
                        className={cn(
                          'h-8 w-full rounded-lg border transition-colors duration-200',
                          !isExpected && 'border-dashed border-border/30 bg-muted/20',
                          isExpected && !isCompleted && 'border-border/60 bg-muted',
                          isCompleted && `${barColor} border-transparent shadow-sm`
                        )}
                        style={isCompleted ? { boxShadow: `0 2px 8px -2px ${ROLES[habit.contextual_role].color}40` } : undefined}
                      />
                      <span className="text-[9px] font-medium text-muted-foreground/60">
                        {dayLabels[index]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <Link
        href="/habits"
        className="group mt-5 flex w-full items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-muted/30 py-2.5 text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:text-primary"
      >
        Lihat Detail
        <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
      </Link>
    </div>
  );
}
