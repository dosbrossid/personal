// ============================================================
// TypeScript Types — Mirrors database schema
// ============================================================

import type {
  RoleContext,
  TaskStatus,
  Priority,
  AcademicDocType,
  NoteType,
  HabitCadenceMode,
  ClassCourseStatus,
  ClassSessionStatus,
} from '@/core/constants';

// Base fields present on all data tables
export interface BaseRecord {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
}

// ─── Users ───
export interface UserPreferences {
  timezone: string;
  theme: 'light' | 'dark' | 'system';
  locale: string;
  onboarding_completed: boolean;
  active_roles?: RoleContext[];
  ai_memory?: {
    summary?: string | null;
    pinned?: string[];
    updated_at?: string | null;
  };
  notifications?: {
    task_deadline: boolean;
    habit_daily: boolean;
    calendar_event: boolean;
    weekly_digest_telegram: boolean;
    telegram_enabled: boolean;
    push_enabled: boolean;
  };
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  telegram_chat_id: string | null;
  preferences: UserPreferences;
  created_at: string;
  updated_at: string;
}

// ─── Categories ───
export interface Category extends BaseRecord {
  name: string;
  color: string;
  icon: string;
  contextual_role: RoleContext;
  is_system: boolean;
}

// ─── Item Categories (Junction) ───
export type ItemType = 'brain_note' | 'task' | 'academic_vault' | 'calendar_event';

export interface ItemCategory {
  id: string;
  item_id: string;
  item_type: ItemType;
  category_id: string;
  created_at: string;
  category?: Category;
}

// ─── Brain Notes ───
export interface BrainNote extends BaseRecord {
  title: string;
  content_body: string;
  note_type: NoteType;
  contextual_role: RoleContext;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_size_bytes: number | null;
  source_url: string | null;
  ai_summary: string | null;
  is_pinned: boolean;
  categories?: ItemCategory[];
}

// ─── Academic Vault ───
export interface AcademicVaultItem extends BaseRecord {
  title: string;
  description: string;
  document_type: AcademicDocType;
  file_format: string;
  file_url: string;
  gdrive_id: string | null;
  file_size_bytes: number | null;
  ai_summary: string | null;
  semester: string | null;
  mata_kuliah: string | null;
  categories?: ItemCategory[];
}

// ─── Tasks ───
export interface Task extends BaseRecord {
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  contextual_role: RoleContext;
  due_date: string | null;
  completed_at: string | null;
  categories?: ItemCategory[];
}

// ─── Habits ───
export interface HabitCadenceConfig {
  days?: number[];
  interval_days?: number;
  anchor_date?: string;
  target?: number;
}

export interface Habit extends BaseRecord {
  name: string;
  cadence_mode: HabitCadenceMode;
  cadence_config: HabitCadenceConfig;
  contextual_role: RoleContext;
  is_active: boolean;
  logs?: HabitLog[];
}

export interface HabitLog {
  id: string;
  habit_id: string;
  log_date: string;
  is_completed: boolean;
  created_at: string;
}

// ─── Calendar Events ───
export type CalendarReminderRule =
  | { type: 'before_minutes'; minutes: number }
  | { type: 'same_day_at'; hour: number; minute: number };

export interface CalendarEvent extends BaseRecord {
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  is_all_day: boolean;
  reminder_minutes: number | null;
  reminder_config?: CalendarReminderRule[] | null;
  contextual_role: RoleContext;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  categories?: ItemCategory[];
}

export interface PublicHoliday {
  id: string;
  country_code: string;
  holiday_date: string;
  local_name: string;
  name: string;
  is_global: boolean;
  holiday_types: string[];
  source: string;
  source_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CalendarDisplayEvent {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string | null;
  is_all_day: boolean;
  reminder_minutes: number | null;
  reminder_config?: CalendarReminderRule[] | null;
  contextual_role: RoleContext;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  created_at: string;
  updated_at: string;
  is_deleted: boolean;
  categories?: ItemCategory[];
  event_source: 'user' | 'holiday';
  is_readonly: boolean;
  holiday_date?: string | null;
}

// ─── Class Management ───
export interface ClassCourse extends BaseRecord {
  name: string;
  course_code: string | null;
  semester_label: string | null;
  meeting_target: 8 | 16;
  student_count: number;
  default_day_of_week: number | null;
  default_start_time: string | null;
  default_end_time: string | null;
  location: string | null;
  contextual_role: RoleContext;
  status: ClassCourseStatus;
  notes: string | null;
  assignment_count: number;
  completed_meeting_count: number;
  next_session?: ClassSession | null;
}

export interface ClassSession extends BaseRecord {
  class_course_id: string;
  meeting_number: number;
  title: string;
  description: string | null;
  session_date: string;
  start_at: string;
  end_at: string | null;
  status: ClassSessionStatus;
  attendance_count: number;
  assignment_given: boolean;
  assignment_title: string | null;
  assignment_due_at: string | null;
  reflection_note: string | null;
  calendar_event_id: string | null;
}

// ─── Notification Queue ───
export interface Notification {
  id: string;
  user_id: string;
  channel: 'push' | 'telegram';
  title: string;
  body: string;
  reference_type: string | null;
  reference_id: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  status: 'pending' | 'sent' | 'failed';
  error_message: string | null;
  retry_count: number;
  created_at: string;
}

// ─── AI Hub Logs ───
export interface AIHubLog {
  id: string;
  user_id: string;
  source: 'in_app' | 'telegram';
  telegram_message_id: number | null;
  raw_input: string;
  ai_response: AIResponse | null;
  status: 'pending' | 'draft' | 'confirmed' | 'failed' | 'cancelled';
  error_message: string | null;
  tokens_used: number | null;
  latency_ms: number | null;
  created_at: string;
  updated_at: string;
}

// ─── AI Response Schema ───
export interface AIResponseItem {
  action: 'TASK' | 'NOTE' | 'CALENDAR' | 'ACADEMIC' | 'CLASS';
  data: {
    title: string;
    description: string | null;
    contextual_role: RoleContext;
    category_names: string[];
    suggested_new_category: string | null;
    due_date: string | null;
    start_at: string | null;
    end_at: string | null;
    priority: Priority;
    source_url: string | null;
    file_format: string | null;
    reminder_minutes: number | null;
    reminder_config?: CalendarReminderRule[] | null;
    semester: string | null;
    mata_kuliah: string | null;
    meeting_target?: 8 | 16 | null;
    student_count?: number | null;
    course_code?: string | null;
    location?: string | null;
  };
}

export interface AIResponse {
  items: AIResponseItem[];
  ai_message: string;
}

// ─── Audit Logs ───
export interface AuditLog {
  id: string;
  user_id: string;
  table_name: string;
  record_id: string;
  action: 'create' | 'update' | 'soft_delete' | 'restore';
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ─── Blog Posts ───
export type BlogStatus = 'draft' | 'published' | 'archived';
export type BlogVisibility = 'public' | 'unlisted' | 'private';

export interface BlogPost {
  id: string;
  user_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content_json: unknown; // Tiptap JSON
  content_html: string;
  content_text: string;
  status: BlogStatus;
  visibility: BlogVisibility;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  meta_title: string | null;
  meta_description: string | null;
  canonical_url: string | null;
  reading_time_minutes: number;
  word_count: number;
  view_count: number;
  is_featured: boolean;
  is_pinned: boolean;
  published_at: string | null;
  scheduled_at: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  tags?: BlogTag[];
}

export interface BlogTag {
  id: string;
  user_id: string;
  name: string;
  slug: string;
  description: string | null;
  color: string;
  post_count: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

export interface BlogPostTag {
  id: string;
  post_id: string;
  tag_id: string;
  sort_order: number;
  created_at: string;
}

export interface BlogMedia {
  id: string;
  user_id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size_bytes: number;
  width: number | null;
  height: number | null;
  alt_text: string | null;
  caption: string | null;
  used_in_post_id: string | null;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
}

// ─── Dashboard Stats ───
export interface DashboardStats {
  activeTasks: number;
  urgentTasks: number;
  completedToday: number;
  habitCompletion: number;
  totalNotes: number;
  pinnedNotes: number;
  todayEvents: number;
  upcomingEvents: number;
}

export interface DashboardActivityItem {
  id: string;
  table_name: string;
  action: string;
  title: string;
  description: string;
  created_at: string;
}

export interface DashboardActivityResponse {
  items: DashboardActivityItem[];
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface AIUsageStats {
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number;
}

// ─── Server Action Result ───
export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

// ─── Global Search Result ───
export interface SearchResult {
  id: string;
  type: 'note' | 'task' | 'vault' | 'calendar';
  title: string;
  description: string | null;
  role: RoleContext;
  created_at: string;
}
