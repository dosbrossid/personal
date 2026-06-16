import { format, isToday, isTomorrow } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import type { ClassCourse, ClassSession } from '@/core/types';
import { SEMESTERS } from '@/core/constants';

export function toDateInput(value?: string | null) {
  if (!value) return '';
  return value.slice(0, 10);
}

export function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const timezoneOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16);
}

export function toIsoString(value?: string | null) {
  if (!value) return null;
  return new Date(value).toISOString();
}

export function formatSessionMoment(session: ClassSession) {
  const start = new Date(session.start_at);
  return `${format(start, 'EEE, dd MMM yyyy', { locale: idLocale })} • ${format(start, 'HH:mm')}`;
}

export function getUpcomingLabel(dateValue: string) {
  const date = new Date(dateValue);
  if (isToday(date)) return 'Hari ini';
  if (isTomorrow(date)) return 'Besok';
  return format(date, 'EEE, dd MMM', { locale: idLocale });
}

export function getProgress(course: ClassCourse) {
  if (!course.meeting_target) return 0;
  return Math.min(100, Math.round((course.completed_meeting_count / course.meeting_target) * 100));
}

export function getSemesterOptions(classes: ClassCourse[]) {
  const dynamicValues = classes
    .map((course) => course.semester_label)
    .filter((value): value is string => Boolean(value));

  return Array.from(new Set([...SEMESTERS, ...dynamicValues]));
}

export function getAcademicSemesterLabel(dateValue?: string | null) {
  const baseDate = dateValue ? new Date(`${dateValue}T12:00:00`) : new Date();
  const month = baseDate.getMonth();
  const year = baseDate.getFullYear();

  if (month === 0) {
    return `Ganjil ${year - 1}/${year}`;
  }

  if (month >= 1 && month <= 6) {
    return `Genap ${year - 1}/${year}`;
  }

  return `Ganjil ${year}/${year + 1}`;
}
