// ============================================================
// Core Constants — Enum values, role colors, and system config
// ============================================================

// Role Context - Colors harmonized with emerald primary theme
export const ROLES = {
  dosen: { label: 'Dosen', color: '#3b82f6', icon: '🎓', bgClass: 'bg-blue-500/10 text-blue-600' },
  creator: { label: 'Kreator', color: '#f59e0b', icon: '🎨', bgClass: 'bg-amber-500/10 text-amber-600' },
  affiliate: { label: 'Afiliator', color: '#ec4899', icon: '📱', bgClass: 'bg-pink-500/10 text-pink-600' },
  consultant: { label: 'Konsultan', color: '#10b981', icon: '💼', bgClass: 'bg-emerald-500/10 text-emerald-600' },
  general: { label: 'Umum', color: '#8b5cf6', icon: '⭐', bgClass: 'bg-violet-500/10 text-violet-600' },
} as const;

export type RoleContext = keyof typeof ROLES;

// Task Status - Consistent with primary emerald
export const TASK_STATUSES = {
  todo: { label: 'To Do', color: '#64748b', icon: '○' },
  in_progress: { label: 'In Progress', color: '#3b82f6', icon: '◐' },
  done: { label: 'Done', color: '#10b981', icon: '●' },
} as const;

export type TaskStatus = keyof typeof TASK_STATUSES;

// Priority - Red to emerald gradient
export const PRIORITIES = {
  low: { label: 'Low', color: '#64748b', icon: '▽' },
  medium: { label: 'Medium', color: '#f59e0b', icon: '◇' },
  high: { label: 'High', color: '#f97316', icon: '△' },
  urgent: { label: 'Urgent', color: '#ef4444', icon: '⚠' },
} as const;

export type Priority = keyof typeof PRIORITIES;

// Academic Document Types
export const ACADEMIC_DOC_TYPES = {
  rps: 'RPS',
  silabus: 'Silabus',
  jurnal: 'Jurnal',
  sk: 'SK',
  sertifikat: 'Sertifikat',
  materi_ajar: 'Materi Ajar',
  administratif: 'Administratif',
  lainnya: 'Lainnya',
} as const;

export type AcademicDocType = keyof typeof ACADEMIC_DOC_TYPES;

// File Formats
export const FILE_FORMATS = {
  pdf: 'PDF',
  doc: 'DOC',
  docx: 'DOCX',
  jpg: 'JPG',
  jpeg: 'JPEG',
  png: 'PNG',
  gdrive_link: 'Google Drive',
} as const;

// Note Types - Consistent muted tones
export const NOTE_TYPES = {
  text: { label: 'Teks', icon: '📝' },
  link: { label: 'Link', icon: '🔗' },
  idea: { label: 'Ide', icon: '💡' },
  snippet: { label: 'Snippet', icon: '🧩' },
} as const;

export type NoteType = keyof typeof NOTE_TYPES;

// Habit Cadence
export const HABIT_CADENCE_MODES = {
  daily: 'Harian',
  specific_days: 'Hari Spesifik',
  interval_days: 'Selang Hari',
  weekly_target: 'Target Mingguan',
  monthly_target: 'Target Bulanan',
} as const;

export type HabitCadenceMode = keyof typeof HABIT_CADENCE_MODES;

// Recurrence
export const RECURRENCES = {
  none: 'Tidak berulang',
  daily: 'Harian',
  weekly: 'Mingguan',
  monthly: 'Bulanan',
} as const;

// Notification Channels
export const NOTIFICATION_CHANNELS = {
  push: 'Push',
  telegram: 'Telegram',
} as const;

// AI Hub Status
export const AI_HUB_STATUSES = {
  pending: 'Pending',
  draft: 'Draft',
  confirmed: 'Confirmed',
  failed: 'Failed',
} as const;

// Navigation Items
export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: 'LayoutDashboard' },
  { href: '/notes', label: 'Catatan', icon: 'Brain' },
  { href: '/tasks', label: 'Tugas', icon: 'CheckSquare' },
  { href: '/habits', label: 'Kebiasaan', icon: 'Flame' },
  { href: '/calendar', label: 'Kalender', icon: 'CalendarDays' },
  { href: '/vault', label: 'Vault Akademik', icon: 'GraduationCap' },
  { href: '/blog', label: 'Blog CMS', icon: 'PenSquare' },
  { href: '/settings', label: 'Pengaturan', icon: 'Settings' },
] as const;

// Blog Post Statuses - Using emerald primary
export const BLOG_STATUSES = {
  draft: { label: 'Draft', color: '#64748b', icon: '○' },
  published: { label: 'Published', color: '#10b981', icon: '●' },
  archived: { label: 'Archived', color: '#f59e0b', icon: '◐' },
} as const;

// Time Filter Options
export const TIME_FILTERS = [
  { value: 'today', label: 'Hari Ini' },
  { value: '7d', label: '7 Hari Terakhir' },
  { value: '30d', label: '30 Hari Terakhir' },
  { value: 'month', label: 'Bulan Ini' },
  { value: 'all', label: 'Semua' },
] as const;

// Max file upload sizes
export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_JPG_SIZE = 500 * 1024; // 500KB after compression
export const GDRIVE_SUGGESTION_SIZE = 5 * 1024 * 1024; // 5MB

// Pagination
export const DEFAULT_PAGE_SIZE = 20;

// Academic Semesters (used in Vault filtering)
export const SEMESTERS = [
  'Genap 2025/2026',
  'Ganjil 2025/2026',
  'Genap 2024/2025',
  'Ganjil 2024/2025',
] as const;

// Academic Document Type Icons + Colors - Consistent palette
export const ACADEMIC_DOC_ICONS: Record<AcademicDocType, { icon: string; color: string }> = {
  rps: { icon: '📋', color: '#3b82f6' },
  silabus: { icon: '📖', color: '#6366f1' },
  jurnal: { icon: '📄', color: '#f59e0b' },
  sk: { icon: '📜', color: '#10b981' },
  sertifikat: { icon: '🏅', color: '#ec4899' },
  materi_ajar: { icon: '📚', color: '#3b82f6' },
  administratif: { icon: '🗂️', color: '#64748b' },
  lainnya: { icon: '📎', color: '#8b5cf6' },
};
