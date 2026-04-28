import {
  differenceInCalendarDays,
  format,
  getISODay,
  isSameMonth,
  isSameWeek,
  isValid,
  parseISO,
} from 'date-fns';
import type { Habit, HabitCadenceConfig } from '@/core/types';
import { HABIT_CADENCE_MODES, type HabitCadenceMode } from '@/core/constants';

const WEEKDAY_LABELS: Record<number, string> = {
  1: 'Sen',
  2: 'Sel',
  3: 'Rab',
  4: 'Kam',
  5: 'Jum',
  6: 'Sab',
  7: 'Min',
};

const WEEKDAY_DEFAULTS = [1, 2, 3, 4, 5];

export const HABIT_CADENCE_VALUES = Object.keys(HABIT_CADENCE_MODES) as HabitCadenceMode[];

export function normalizeHabitCadenceConfig(
  cadenceMode: HabitCadenceMode,
  cadenceConfig?: HabitCadenceConfig | null,
  fallbackDate: Date = new Date()
): HabitCadenceConfig {
  if (cadenceMode === 'daily') {
    return {};
  }

  if (cadenceMode === 'specific_days') {
    const days = Array.isArray(cadenceConfig?.days)
      ? cadenceConfig.days
          .map((value) => Number(value))
          .filter((value) => Number.isInteger(value) && value >= 1 && value <= 7)
      : [];

    return {
      days: [...new Set(days)].sort((left, right) => left - right),
    };
  }

  if (cadenceMode === 'interval_days') {
    const intervalDays = Math.max(2, Math.min(30, Number(cadenceConfig?.interval_days) || 2));
    const rawAnchor = cadenceConfig?.anchor_date;
    const parsedAnchor = rawAnchor ? parseISO(rawAnchor) : fallbackDate;
    const anchorDate = isValid(parsedAnchor) ? parsedAnchor : fallbackDate;

    return {
      interval_days: intervalDays,
      anchor_date: format(anchorDate, 'yyyy-MM-dd'),
    };
  }

  const targetLimit = cadenceMode === 'weekly_target' ? 7 : 31;
  const targetFallback = cadenceMode === 'weekly_target' ? 3 : 2;
  const target = Math.max(1, Math.min(targetLimit, Number(cadenceConfig?.target) || targetFallback));

  return { target };
}

export function getHabitCadenceLabel(habit: Pick<Habit, 'cadence_mode' | 'cadence_config'>) {
  const cadenceConfig = normalizeHabitCadenceConfig(habit.cadence_mode, habit.cadence_config);

  if (habit.cadence_mode === 'daily') {
    return 'Setiap hari';
  }

  if (habit.cadence_mode === 'specific_days') {
    const days = cadenceConfig.days?.length ? cadenceConfig.days : WEEKDAY_DEFAULTS;
    return days.map((day) => WEEKDAY_LABELS[day]).join(' • ');
  }

  if (habit.cadence_mode === 'interval_days') {
    return `Setiap ${cadenceConfig.interval_days ?? 2} hari`;
  }

  if (habit.cadence_mode === 'weekly_target') {
    return `${cadenceConfig.target ?? 1}x per minggu`;
  }

  return `${cadenceConfig.target ?? 1}x per bulan`;
}

export function isScheduledHabit(habit: Pick<Habit, 'cadence_mode'>) {
  return (
    habit.cadence_mode === 'daily' ||
    habit.cadence_mode === 'specific_days' ||
    habit.cadence_mode === 'interval_days'
  );
}

export function isHabitExpectedOnDate(habit: Pick<Habit, 'cadence_mode' | 'cadence_config'>, day: Date) {
  const cadenceConfig = normalizeHabitCadenceConfig(habit.cadence_mode, habit.cadence_config, day);

  if (habit.cadence_mode === 'daily') {
    return true;
  }

  if (habit.cadence_mode === 'specific_days') {
    const days = cadenceConfig.days?.length ? cadenceConfig.days : WEEKDAY_DEFAULTS;
    return days.includes(getISODay(day));
  }

  if (habit.cadence_mode === 'interval_days') {
    const anchorDate = cadenceConfig.anchor_date ? parseISO(cadenceConfig.anchor_date) : day;
    if (!isValid(anchorDate)) return false;

    const diff = differenceInCalendarDays(day, anchorDate);
    if (diff < 0) return false;

    return diff % (cadenceConfig.interval_days ?? 2) === 0;
  }

  return true;
}

export function isHabitCompletedOnDate(habit: Pick<Habit, 'logs'>, day: Date) {
  const dayKey = format(day, 'yyyy-MM-dd');
  return (habit.logs ?? []).some((log) => log.log_date === dayKey && log.is_completed);
}

export function countHabitLogsInWeek(habit: Pick<Habit, 'logs'>, referenceDate: Date) {
  return (habit.logs ?? []).filter(
    (log) => log.is_completed && isSameWeek(parseISO(log.log_date), referenceDate, { weekStartsOn: 1 })
  ).length;
}

export function countHabitLogsInMonth(habit: Pick<Habit, 'logs'>, referenceDate: Date) {
  return (habit.logs ?? []).filter(
    (log) => log.is_completed && isSameMonth(parseISO(log.log_date), referenceDate)
  ).length;
}

export function getHabitProgressSnapshot(habit: Pick<Habit, 'cadence_mode' | 'cadence_config' | 'logs'>, referenceDate: Date) {
  const cadenceConfig = normalizeHabitCadenceConfig(habit.cadence_mode, habit.cadence_config, referenceDate);

  if (habit.cadence_mode === 'weekly_target') {
    const target = cadenceConfig.target ?? 1;
    const completed = countHabitLogsInWeek(habit, referenceDate);
    return {
      completed,
      target,
      label: 'Pekan ini',
      ratio: Math.min(completed / target, 1),
      isExpectedToday: true,
    };
  }

  if (habit.cadence_mode === 'monthly_target') {
    const target = cadenceConfig.target ?? 1;
    const completed = countHabitLogsInMonth(habit, referenceDate);
    return {
      completed,
      target,
      label: 'Bulan ini',
      ratio: Math.min(completed / target, 1),
      isExpectedToday: true,
    };
  }

  const isExpectedToday = isHabitExpectedOnDate(habit, referenceDate);
  const completed = isExpectedToday && isHabitCompletedOnDate(habit, referenceDate) ? 1 : 0;

  return {
    completed,
    target: isExpectedToday ? 1 : 0,
    label: isExpectedToday ? 'Hari ini' : 'Tidak dijadwalkan',
    ratio: isExpectedToday ? completed : 0,
    isExpectedToday,
  };
}
