import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, isToday, isTomorrow, isYesterday } from 'date-fns';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { id } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Date formatting helpers (timezone-aware, Indonesian locale)
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, 'dd MMM yyyy', { locale: id });
}

export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, 'HH:mm', { locale: id });
}

export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, 'dd MMM yyyy, HH:mm', { locale: id });
}

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  if (isToday(date)) return `Hari ini, ${format(date, 'HH:mm')}`;
  if (isTomorrow(date)) return `Besok, ${format(date, 'HH:mm')}`;
  if (isYesterday(date)) return `Kemarin, ${format(date, 'HH:mm')}`;
  return formatDistanceToNow(date, { addSuffix: true, locale: id });
}

export function formatDayMonth(dateStr: string): string {
  const date = new Date(dateStr);
  return format(date, 'dd MMM', { locale: id });
}

export function getDateKeyInTimezone(date: Date | string, timezone: string): string {
  return formatInTimeZone(typeof date === 'string' ? new Date(date) : date, timezone, 'yyyy-MM-dd');
}

export function getTimeInTimezone(date: Date | string, timezone: string): string {
  return formatInTimeZone(typeof date === 'string' ? new Date(date) : date, timezone, 'HH:mm');
}

export function getTodayRangeInTimezone(timezone: string) {
  const todayKey = getDateKeyInTimezone(new Date(), timezone);

  return {
    todayKey,
    startIso: fromZonedTime(`${todayKey}T00:00:00`, timezone).toISOString(),
    endIso: fromZonedTime(`${todayKey}T23:59:59`, timezone).toISOString(),
  };
}

// File size formatter
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// SWR fetcher (browser-side)
export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Gagal memuat data');
  return res.json();
}

// Truncate text with ellipsis
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength - 3) + '...';
}

// Generate initials from full name
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(w => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Color with opacity
export function colorWithOpacity(hex: string, opacity: number): string {
  return `${hex}${Math.round(opacity * 255).toString(16).padStart(2, '0')}`;
}

// Generate URL-safe slug from title
export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // remove non-word chars (except spaces & hyphens)
    .replace(/[\s_]+/g, '-')  // replace spaces & underscores with hyphens
    .replace(/-+/g, '-')      // collapse multiple hyphens
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}
