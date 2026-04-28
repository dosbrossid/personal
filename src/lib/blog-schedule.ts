import type { BlogPost } from '@/core/types';

export function toDateTimeLocalValue(value: string | null) {
  if (!value) return '';

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';

  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

export function toScheduledAtIso(value: string) {
  if (!value.trim()) return null;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;

  return parsed.toISOString();
}

export function isFutureSchedule(value: string | null) {
  if (!value) return false;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  return parsed.getTime() > Date.now();
}

export function isScheduledDraft(post: Pick<BlogPost, 'status' | 'scheduled_at'>) {
  return post.status === 'draft' && isFutureSchedule(post.scheduled_at);
}
