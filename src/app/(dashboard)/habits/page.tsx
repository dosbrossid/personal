'use client';

import { type ReactNode, useState } from 'react';
import {
  AlertTriangle,
  CalendarRange,
  Check,
  CheckCircle2,
  Filter,
  Flame,
  MoreHorizontal,
  Plus,
  Target,
  Trash2,
  TrendingUp,
  Zap,
} from 'lucide-react';
import { format, subDays } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { StatCard } from '@/components/shared/StatCard';
import { PageSkeleton } from '@/components/shared/PageSkeleton';
import { useHabits } from '@/hooks/use-habits';
import { createHabit, deleteHabit as deleteHabitAction, toggleHabitLog } from '@/actions/habits.actions';
import { HABIT_CADENCE_MODES, ROLES, type HabitCadenceMode, type RoleContext } from '@/core/constants';
import type { Habit, HabitCadenceConfig } from '@/core/types';
import {
  getHabitCadenceLabel,
  getHabitProgressSnapshot,
  isHabitCompletedOnDate,
  isHabitExpectedOnDate,
  isScheduledHabit,
  normalizeHabitCadenceConfig,
} from '@/lib/habits';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';

const roleFilters = [
  { key: 'all', label: 'Semua', icon: '⚡' },
  { key: 'dosen', label: 'Dosen', icon: '🎓' },
  { key: 'creator', label: 'Kreator', icon: '🎨' },
  { key: 'affiliate', label: 'Afiliator', icon: '📱' },
  { key: 'consultant', label: 'Konsultan', icon: '💼' },
  { key: 'general', label: 'Umum', icon: '⭐' },
] as const;

const cadenceOptions: Array<{ key: HabitCadenceMode; label: string; hint: string }> = [
  { key: 'daily', label: HABIT_CADENCE_MODES.daily, hint: 'Dipakai untuk rutinitas yang memang setiap hari.' },
  { key: 'specific_days', label: HABIT_CADENCE_MODES.specific_days, hint: 'Pilih hari tertentu seperti Senin-Rabu-Jumat.' },
  { key: 'interval_days', label: HABIT_CADENCE_MODES.interval_days, hint: 'Cocok untuk pola selang 2 atau 3 hari.' },
  { key: 'weekly_target', label: HABIT_CADENCE_MODES.weekly_target, hint: 'Target fleksibel misalnya 3x per minggu.' },
  { key: 'monthly_target', label: HABIT_CADENCE_MODES.monthly_target, hint: 'Cocok untuk target 2x atau 4x per bulan.' },
];

const weekdayOptions = [
  { value: 1, label: 'Sen' },
  { value: 2, label: 'Sel' },
  { value: 3, label: 'Rab' },
  { value: 4, label: 'Kam' },
  { value: 5, label: 'Jum' },
  { value: 6, label: 'Sab' },
  { value: 7, label: 'Min' },
];

function getCadenceBadgeClass(cadenceMode: HabitCadenceMode) {
  if (cadenceMode === 'daily') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300';
  if (cadenceMode === 'specific_days') return 'bg-blue-500/10 text-blue-600 dark:text-blue-300';
  if (cadenceMode === 'interval_days') return 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-300';
  if (cadenceMode === 'weekly_target') return 'bg-violet-500/10 text-violet-600 dark:text-violet-300';
  return 'bg-amber-500/10 text-amber-600 dark:text-amber-300';
}

export default function HabitsPage() {
  const { habits, isLoading, mutate } = useHabits();
  const [selectedRole, setSelectedRole] = useState<RoleContext | 'all'>('all');
  const [createOpen, setCreateOpen] = useState(false);
  const [deletingHabit, setDeleteHabit] = useState<Habit | null>(null);

  const today = new Date();
  const todayKey = format(today, 'yyyy-MM-dd');
  const days = Array.from({ length: 14 }, (_, index) => subDays(today, 13 - index));

  const activeHabits = habits.filter((habit) => {
    if (!habit.is_active) return false;
    if (selectedRole !== 'all' && habit.contextual_role !== selectedRole) return false;
    return true;
  });

  const scheduledHabits = activeHabits.filter((habit) => isScheduledHabit(habit));
  const flexibleHabits = activeHabits.filter((habit) => !isScheduledHabit(habit));

  const todayDueHabits = scheduledHabits.filter((habit) => isHabitExpectedOnDate(habit, today));
  const todayCompleted = todayDueHabits.filter((habit) => isHabitCompletedOnDate(habit, today)).length;
  const todayPct = todayDueHabits.length > 0 ? Math.round((todayCompleted / todayDueHabits.length) * 100) : 0;

  const flexibleSnapshots = flexibleHabits.map((habit) => getHabitProgressSnapshot(habit, today));
  const flexibleCompleted = flexibleSnapshots.reduce((total, snapshot) => total + Math.min(snapshot.completed, snapshot.target), 0);
  const flexibleTarget = flexibleSnapshots.reduce((total, snapshot) => total + snapshot.target, 0);

  const bestStreak = scheduledHabits.reduce((best, habit) => {
    let streak = 0;

    for (let index = days.length - 1; index >= 0; index -= 1) {
      const day = days[index];
      if (!isHabitExpectedOnDate(habit, day)) continue;

      if (isHabitCompletedOnDate(habit, day)) streak += 1;
      else break;
    }

    return Math.max(best, streak);
  }, 0);

  const statCards = [
    { label: 'Total Habit', value: activeHabits.length, icon: Target, gradient: 'gradient-amber', glow: 'shadow-amber-500/20' },
    { label: 'Best Streak', value: `${bestStreak}d`, icon: Flame, gradient: 'gradient-rose', glow: 'shadow-rose-500/20' },
    { label: 'Check-in Hari Ini', value: `${todayPct}%`, icon: TrendingUp, gradient: 'gradient-emerald', glow: 'shadow-emerald-500/20' },
    {
      label: 'Target Fleksibel',
      value: flexibleTarget > 0 ? `${flexibleCompleted}/${flexibleTarget}` : '0/0',
      icon: CalendarRange,
      gradient: 'gradient-violet',
      glow: 'shadow-violet-500/20',
    },
  ];

  const handleToggle = async (habitId: string, dateKey: string) => {
    const result = await toggleHabitLog(habitId, dateKey);
    if (result.error) {
      toast.error(result.error);
      return;
    }

    mutate();
  };

  const handleCreate = async (
    name: string,
    role: RoleContext,
    cadenceMode: HabitCadenceMode,
    cadenceConfig: HabitCadenceConfig
  ) => {
    const result = await createHabit({
      name,
      cadence_mode: cadenceMode,
      cadence_config: cadenceConfig,
      contextual_role: role,
    });

    if (result.error) {
      toast.error(result.error);
      return false;
    }

    toast.success(`"${name}" ditambahkan`);
    mutate();
    return true;
  };

  const handleDelete = async () => {
    if (!deletingHabit) return;

    const result = await deleteHabitAction(deletingHabit.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success(`"${deletingHabit.name}" dihapus`);
      mutate();
    }

    setDeleteHabit(null);
  };

  if (isLoading) {
    return <PageSkeleton statCount={4} contentRows={5} />;
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2.5 ts-display text-foreground">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-lg shadow-orange-500/20">
                <Flame className="h-5 w-5" />
              </div>
              Habit Tracker
            </h1>
            <p className="mt-1 text-[14px] text-muted-foreground">
              Kebiasaan dengan ritme harian, hari spesifik, selang hari, dan target periodik
            </p>
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-foreground to-foreground/90 px-5 py-2.5 text-[13px] font-medium text-background shadow-lg shadow-foreground/10 transition-all duration-200 active:scale-[0.97] hover:opacity-90"
          >
            <Plus className="h-4 w-4" /> Habit Baru
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((card) => (
            <StatCard
              key={card.label}
              label={card.label}
              value={card.value}
              icon={card.icon}
              gradient={card.gradient}
              glow={card.glow}
            />
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="mr-1 flex items-center gap-2 text-muted-foreground">
            <Filter className="h-4 w-4" />
            <span className="text-[12px] font-medium">Filter:</span>
          </div>
          {roleFilters.map((role) => (
            <button
              key={role.key}
              onClick={() => setSelectedRole(role.key as RoleContext | 'all')}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-all duration-200',
                selectedRole === role.key
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span>{role.icon}</span>
              <span>{role.label}</span>
            </button>
          ))}
        </div>

        {scheduledHabits.length > 0 && (
          <HabitSection
            icon={<Zap className="h-4 w-4 text-emerald-500" />}
            title="Jadwal Tetap"
            count={scheduledHabits.length}
            habits={scheduledHabits}
            days={days}
            todayKey={todayKey}
            onToggle={handleToggle}
            onDelete={setDeleteHabit}
            variant="scheduled"
          />
        )}

        {flexibleHabits.length > 0 && (
          <HabitSection
            icon={<CalendarRange className="h-4 w-4 text-violet-500" />}
            title="Target Fleksibel"
            count={flexibleHabits.length}
            habits={flexibleHabits}
            days={days}
            todayKey={todayKey}
            onToggle={handleToggle}
            onDelete={setDeleteHabit}
            variant="flexible"
          />
        )}

        {activeHabits.length === 0 && (
          <div className="rounded-2xl border border-border/60 bg-card py-20 text-center shadow-sm">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Target className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="mb-1 text-[14px] font-medium text-foreground">Tidak ada habit aktif</p>
            <p className="mb-4 text-[12px] text-muted-foreground">
              Mulai tracking kebiasaanmu dengan ritme yang benar-benar sesuai kehidupan sehari-hari
            </p>
            <Button
              onClick={() => setCreateOpen(true)}
              size="sm"
              className="gap-1.5 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 text-[11px] font-semibold text-white shadow-md shadow-orange-500/20"
            >
              <Plus className="h-3 w-3" /> Buat Habit
            </Button>
          </div>
        )}
      </div>

      {createOpen && <HabitCreateModal open={createOpen} onClose={() => setCreateOpen(false)} onSave={handleCreate} />}

      {deletingHabit && (
        <Dialog open={!!deletingHabit} onOpenChange={() => setDeleteHabit(null)}>
          <DialogContent className="border-border/60 bg-card sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5 ts-title">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-500">
                  <AlertTriangle className="h-4.5 w-4.5" />
                </div>
                Hapus Habit?
              </DialogTitle>
              <DialogDescription className="pt-2 text-[13px] text-muted-foreground">
                Apakah yakin menghapus <span className="font-semibold text-foreground">&ldquo;{deletingHabit.name}&rdquo;</span>?
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDeleteHabit(null)} className="h-9 rounded-lg border-border/60 text-[12px]">
                Batal
              </Button>
              <Button
                onClick={handleDelete}
                className="h-9 gap-2 rounded-lg bg-red-500 text-[12px] font-semibold text-white shadow-md shadow-red-500/25 transition-all hover:bg-red-600"
              >
                <Trash2 className="h-3.5 w-3.5" /> Ya, Hapus
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function HabitSection({
  icon,
  title,
  count,
  habits,
  days,
  todayKey,
  onToggle,
  onDelete,
  variant,
}: {
  icon: ReactNode;
  title: string;
  count: number;
  habits: Habit[];
  days: Date[];
  todayKey: string;
  onToggle: (habitId: string, dateKey: string) => Promise<void>;
  onDelete: (habit: Habit) => void;
  variant: 'scheduled' | 'flexible';
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {icon}
        <h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
        <span className="text-[12px] text-muted-foreground/70">({count})</span>
      </div>

      <div className="space-y-3 md:hidden">
        {habits.map((habit) => (
          <HabitMobileCard
            key={habit.id}
            habit={habit}
            days={days.slice(-7)}
            todayKey={todayKey}
            onToggle={onToggle}
            onDelete={onDelete}
            variant={variant}
          />
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-2xl border border-border/60 bg-card shadow-sm md:block">
        <div className="grid min-w-[900px] gap-0" style={{ gridTemplateColumns: '240px repeat(14, 1fr)' }}>
          <div className="border-b border-r border-border/60 bg-muted/30 px-5 py-4">
            <span className="text-[13px] font-semibold text-foreground">Kebiasaan</span>
          </div>
          {days.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const isToday = dateKey === todayKey;
            return (
              <div key={dateKey} className={cn('border-b border-border/60 px-1 py-3 text-center', isToday && 'bg-primary/10')}>
                <p className={cn('text-[10px] font-medium uppercase', isToday ? 'text-primary' : 'text-muted-foreground')}>
                  {format(day, 'EEE', { locale: idLocale })}
                </p>
                <p className={cn('mt-0.5 text-[13px] font-bold', isToday ? 'text-primary' : 'text-foreground')}>
                  {format(day, 'dd')}
                </p>
              </div>
            );
          })}
        </div>

        {habits.map((habit) => (
          <HabitDesktopRow
            key={habit.id}
            habit={habit}
            days={days}
            todayKey={todayKey}
            onToggle={onToggle}
            onDelete={onDelete}
            variant={variant}
          />
        ))}
      </div>
    </div>
  );
}

function HabitMobileCard({
  habit,
  days,
  todayKey,
  onToggle,
  onDelete,
  variant,
}: {
  habit: Habit;
  days: Date[];
  todayKey: string;
  onToggle: (habitId: string, dateKey: string) => Promise<void>;
  onDelete: (habit: Habit) => void;
  variant: 'scheduled' | 'flexible';
}) {
  const progress = getHabitProgressSnapshot(habit, new Date());
  const helperText =
    variant === 'scheduled'
      ? `${days.filter((day) => isHabitExpectedOnDate(habit, day)).filter((day) => isHabitCompletedOnDate(habit, day)).length}/${days.filter((day) => isHabitExpectedOnDate(habit, day)).length || 0} check-in`
      : `${progress.completed}/${progress.target} ${progress.label.toLowerCase()}`;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-foreground">{habit.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', ROLES[habit.contextual_role].bgClass)}>
              {ROLES[habit.contextual_role].icon} {ROLES[habit.contextual_role].label}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', getCadenceBadgeClass(habit.cadence_mode))}>
              {HABIT_CADENCE_MODES[habit.cadence_mode]}
            </span>
            <span className="text-[11px] text-muted-foreground">{helperText}</span>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">{getHabitCadenceLabel(habit)}</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-all duration-200 hover:bg-muted">
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl border-border/60 bg-card shadow-xl">
            <DropdownMenuItem
              onClick={() => onDelete(habit)}
              className="gap-2 rounded-lg text-[13px] text-red-500 focus:bg-red-500/10 focus:text-red-500"
            >
              <Trash2 className="h-4 w-4" /> Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.map((day) => {
          const dateKey = format(day, 'yyyy-MM-dd');
          const isToday = dateKey === todayKey;
          const isExpected = variant === 'scheduled' ? isHabitExpectedOnDate(habit, day) : true;
          const isCompleted = isHabitCompletedOnDate(habit, day);

          return (
            <button
              key={dateKey}
              onClick={() => onToggle(habit.id, dateKey)}
              disabled={!isExpected}
              className={cn(
                'rounded-xl border px-2 py-2 text-center transition-all duration-200 active:scale-95',
                !isExpected && 'cursor-not-allowed border-dashed border-border/40 bg-muted/20 text-muted-foreground/50',
                isExpected && !isCompleted && 'border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted',
                isCompleted && 'border-emerald-500/20 bg-emerald-500 text-white shadow-sm shadow-emerald-500/20'
              )}
            >
              <p className={cn('text-[9px] font-medium uppercase', isCompleted ? 'text-white/80' : isToday ? 'text-primary' : '')}>
                {format(day, 'EEE', { locale: idLocale })}
              </p>
              <div className="mt-1 flex justify-center">
                {!isExpected ? (
                  <span className="text-[11px] font-semibold">-</span>
                ) : isCompleted ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <span className="text-[11px] font-semibold">{format(day, 'dd')}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function HabitDesktopRow({
  habit,
  days,
  todayKey,
  onToggle,
  onDelete,
  variant,
}: {
  habit: Habit;
  days: Date[];
  todayKey: string;
  onToggle: (habitId: string, dateKey: string) => Promise<void>;
  onDelete: (habit: Habit) => void;
  variant: 'scheduled' | 'flexible';
}) {
  const progress = getHabitProgressSnapshot(habit, new Date());

  return (
    <div
      className="grid min-w-[900px] gap-0 border-b border-border/40 transition-colors last:border-b-0 hover:bg-muted/20"
      style={{ gridTemplateColumns: '240px repeat(14, 1fr)' }}
    >
      <div className="group flex items-center gap-3 border-r border-border/60 px-5 py-4">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-medium text-foreground">{habit.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', ROLES[habit.contextual_role].bgClass)}>
              {ROLES[habit.contextual_role].icon} {ROLES[habit.contextual_role].label}
            </span>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-medium', getCadenceBadgeClass(habit.cadence_mode))}>
              {HABIT_CADENCE_MODES[habit.cadence_mode]}
            </span>
          </div>
          <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {variant === 'scheduled' ? getHabitCadenceLabel(habit) : `${getHabitCadenceLabel(habit)} • ${progress.completed}/${progress.target} ${progress.label.toLowerCase()}`}
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="shrink-0 rounded-lg p-1.5 opacity-0 transition-all duration-200 hover:bg-muted group-hover:opacity-100">
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44 rounded-xl border-border/60 bg-card shadow-xl">
            <DropdownMenuItem
              onClick={() => onDelete(habit)}
              className="gap-2 rounded-lg text-[13px] text-red-500 focus:bg-red-500/10 focus:text-red-500"
            >
              <Trash2 className="h-4 w-4" /> Hapus
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {days.map((day) => {
        const dateKey = format(day, 'yyyy-MM-dd');
        const isToday = dateKey === todayKey;
        const isExpected = variant === 'scheduled' ? isHabitExpectedOnDate(habit, day) : true;
        const isCompleted = isHabitCompletedOnDate(habit, day);

        return (
          <div key={dateKey} className={cn('flex items-center justify-center py-4', isToday && 'bg-primary/10')}>
            <button
              onClick={() => onToggle(habit.id, dateKey)}
              disabled={!isExpected}
              className={cn(
                'flex h-8 w-8 items-center justify-center rounded-lg transition-all duration-200 active:scale-90',
                !isExpected && 'cursor-not-allowed border border-dashed border-border/40 bg-muted/20 text-muted-foreground/40',
                isExpected && !isCompleted && 'border border-border/60 bg-muted/50 hover:border-emerald-500/30 hover:bg-muted',
                isCompleted && 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30'
              )}
            >
              {!isExpected ? <span className="text-[11px]">-</span> : isCompleted && <Check className="h-4 w-4" />}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function HabitCreateModal({
  open,
  onClose,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  onSave: (
    name: string,
    role: RoleContext,
    cadenceMode: HabitCadenceMode,
    cadenceConfig: HabitCadenceConfig
  ) => Promise<boolean | void>;
}) {
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<RoleContext>('general');
  const [cadenceMode, setCadenceMode] = useState<HabitCadenceMode>('daily');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 3, 5]);
  const [intervalDays, setIntervalDays] = useState(2);
  const [anchorDate, setAnchorDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [target, setTarget] = useState(3);

  const cadenceConfig = (() => {
    if (cadenceMode === 'specific_days') {
      return normalizeHabitCadenceConfig(cadenceMode, { days: selectedDays });
    }

    if (cadenceMode === 'interval_days') {
      return normalizeHabitCadenceConfig(cadenceMode, {
        interval_days: intervalDays,
        anchor_date: anchorDate,
      });
    }

    if (cadenceMode === 'weekly_target' || cadenceMode === 'monthly_target') {
      return normalizeHabitCadenceConfig(cadenceMode, { target });
    }

    return normalizeHabitCadenceConfig(cadenceMode, {});
  })();

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('Nama habit wajib diisi');
      return;
    }

    if (cadenceMode === 'specific_days' && selectedDays.length === 0) {
      toast.error('Pilih minimal satu hari');
      return;
    }

    setIsSaving(true);
    const result = await onSave(name, role, cadenceMode, cadenceConfig);
    setIsSaving(false);

    if (result !== false) {
      onClose();
      setName('');
      setRole('general');
      setCadenceMode('daily');
      setSelectedDays([1, 3, 5]);
      setIntervalDays(2);
      setAnchorDate(format(new Date(), 'yyyy-MM-dd'));
      setTarget(3);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-h-[88vh] overflow-hidden border-border/60 bg-card p-0 sm:max-w-3xl">
        <div className="flex max-h-[88vh] flex-col">
          <DialogHeader className="shrink-0 border-b border-border/40 px-6 py-5 pb-4">
            <DialogTitle className="flex items-center gap-2.5 ts-h2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-rose-500 text-white shadow-md shadow-orange-500/20">
                <Plus className="h-4 w-4" />
              </div>
              Habit Baru
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            <div className="space-y-5 lg:grid lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-6 lg:space-y-0">
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nama Habit</label>
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="cth: Ngegym"
                    className="h-10 rounded-lg border-border/60 bg-background text-[14px] font-medium"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Peran</label>
                  <select
                    value={role}
                    onChange={(event) => setRole(event.target.value as RoleContext)}
                    className="h-9 w-full rounded-lg border border-border/60 bg-background px-3 text-[12px] text-foreground outline-none focus:ring-1 focus:ring-primary/30"
                  >
                    {Object.entries(ROLES).map(([key, value]) => (
                      <option key={key} value={key}>
                        {value.icon} {value.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-2xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Preview Ritme</p>
                  <p className="mt-2 ts-title text-foreground">
                    {HABIT_CADENCE_MODES[cadenceMode]}
                  </p>
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {getHabitCadenceLabel({ cadence_mode: cadenceMode, cadence_config: cadenceConfig })}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Ritme Habit</label>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {cadenceOptions.map((option) => (
                      <button
                        key={option.key}
                        onClick={() => setCadenceMode(option.key)}
                        className={cn(
                          'rounded-xl border px-3 py-3 text-left transition-all duration-200',
                          cadenceMode === option.key
                            ? 'border-foreground/10 bg-foreground text-background shadow-sm'
                            : 'border-border/60 bg-muted/30 text-foreground hover:bg-muted'
                        )}
                      >
                        <p className="text-[12px] font-semibold">{option.label}</p>
                        <p className={cn('mt-1 text-[11px]', cadenceMode === option.key ? 'text-background/70' : 'text-muted-foreground')}>
                          {option.hint}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {cadenceMode === 'specific_days' && (
                  <div className="space-y-2">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Pilih Hari</label>
                    <div className="grid grid-cols-4 gap-2">
                      {weekdayOptions.map((day) => {
                        const active = selectedDays.includes(day.value);
                        return (
                          <button
                            key={day.value}
                            onClick={() =>
                              setSelectedDays((current) =>
                                current.includes(day.value)
                                  ? current.filter((value) => value !== day.value)
                                  : [...current, day.value].sort((left, right) => left - right)
                              )
                            }
                            className={cn(
                              'rounded-lg border px-3 py-2 text-[12px] font-medium transition-all',
                              active
                                ? 'border-primary/20 bg-primary text-primary-foreground'
                                : 'border-border/60 bg-muted/30 text-foreground hover:bg-muted'
                            )}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {cadenceMode === 'interval_days' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Setiap N Hari</label>
                      <Input
                        type="number"
                        min={2}
                        max={30}
                        value={intervalDays}
                        onChange={(event) => setIntervalDays(Number(event.target.value) || 2)}
                        className="h-10 rounded-lg border-border/60 bg-background text-[14px] font-medium"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mulai Dari</label>
                      <Input
                        type="date"
                        value={anchorDate}
                        onChange={(event) => setAnchorDate(event.target.value)}
                        className="h-10 rounded-lg border-border/60 bg-background text-[14px] font-medium"
                      />
                    </div>
                  </div>
                )}

                {(cadenceMode === 'weekly_target' || cadenceMode === 'monthly_target') && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                      {cadenceMode === 'weekly_target' ? 'Target per Minggu' : 'Target per Bulan'}
                    </label>
                    <Input
                      type="number"
                      min={1}
                      max={cadenceMode === 'weekly_target' ? 7 : 31}
                      value={target}
                      onChange={(event) => setTarget(Number(event.target.value) || 1)}
                      className="h-10 rounded-lg border-border/60 bg-background text-[14px] font-medium"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="shrink-0 border-t border-border/40 bg-card/95 px-6 py-4 supports-backdrop-filter:backdrop-blur">
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={onClose} className="h-9 rounded-lg border-border/60 text-[12px]">
                Batal
              </Button>
              <Button
                onClick={handleSave}
                disabled={!name.trim() || isSaving}
                className="h-9 gap-2 rounded-lg bg-gradient-to-r from-orange-500 to-rose-500 text-[12px] font-semibold text-white shadow-md shadow-orange-500/25 transition-all hover:opacity-90 disabled:opacity-40"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> {isSaving ? 'Menyimpan...' : 'Buat Habit'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
