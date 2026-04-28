-- ============================================================
-- Personal Dashboard - Full Public Schema Rebuild
-- Run this once in Supabase SQL Editor.
-- WARNING: This drops all app tables in public schema.
-- ============================================================

BEGIN;

DROP TABLE IF EXISTS public.item_categories CASCADE;
DROP TABLE IF EXISTS public.ai_hub_logs CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.newsletter_subscribers CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.blog_media CASCADE;
DROP TABLE IF EXISTS public.blog_post_tags CASCADE;
DROP TABLE IF EXISTS public.blog_tags CASCADE;
DROP TABLE IF EXISTS public.blog_posts CASCADE;
DROP TABLE IF EXISTS public.academic_vault_items CASCADE;
DROP TABLE IF EXISTS public.public_holidays CASCADE;
DROP TABLE IF EXISTS public.calendar_events CASCADE;
DROP TABLE IF EXISTS public.habit_logs CASCADE;
DROP TABLE IF EXISTS public.habits CASCADE;
DROP TABLE IF EXISTS public.brain_notes CASCADE;
DROP TABLE IF EXISTS public.tasks CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.audit_trigger_fn() CASCADE;
DROP FUNCTION IF EXISTS public.handle_auth_user_upsert() CASCADE;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  telegram_chat_id TEXT,
  preferences JSONB NOT NULL DEFAULT '{"timezone":"Asia/Jakarta","theme":"dark","locale":"id","onboarding_completed":false}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT NOT NULL DEFAULT 'folder',
  contextual_role TEXT NOT NULL CHECK (contextual_role IN ('dosen','creator','affiliate','consultant','general')),
  is_system BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
  contextual_role TEXT NOT NULL CHECK (contextual_role IN ('dosen','creator','affiliate','consultant','general')),
  due_date DATE,
  completed_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.brain_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content_body TEXT NOT NULL DEFAULT '',
  note_type TEXT NOT NULL DEFAULT 'text' CHECK (note_type IN ('text','link','idea','snippet')),
  contextual_role TEXT NOT NULL CHECK (contextual_role IN ('dosen','creator','affiliate','consultant','general')),
  attachment_url TEXT,
  attachment_type TEXT,
  attachment_size_bytes BIGINT,
  source_url TEXT,
  ai_summary TEXT,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.habits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cadence_mode TEXT NOT NULL DEFAULT 'daily' CHECK (cadence_mode IN ('daily','specific_days','interval_days','weekly_target','monthly_target')),
  cadence_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  contextual_role TEXT NOT NULL CHECK (contextual_role IN ('dosen','creator','affiliate','consultant','general')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.habit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id UUID NOT NULL REFERENCES public.habits(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_habit_logs_habit_date UNIQUE (habit_id, log_date)
);

CREATE TABLE public.calendar_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  reminder_minutes INT,
  contextual_role TEXT NOT NULL CHECK (contextual_role IN ('dosen','creator','affiliate','consultant','general')),
  recurrence TEXT NOT NULL DEFAULT 'none' CHECK (recurrence IN ('none','daily','weekly','monthly')),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.public_holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL,
  holiday_date DATE NOT NULL,
  local_name TEXT NOT NULL,
  name TEXT NOT NULL,
  is_global BOOLEAN NOT NULL DEFAULT true,
  holiday_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  source TEXT NOT NULL DEFAULT 'nager-date',
  source_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_public_holidays_country_date_name UNIQUE (country_code, holiday_date, name)
);

CREATE TABLE public.academic_vault_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  document_type TEXT NOT NULL,
  file_format TEXT NOT NULL,
  file_url TEXT NOT NULL,
  gdrive_id TEXT,
  file_size_bytes BIGINT,
  ai_summary TEXT,
  semester TEXT,
  mata_kuliah TEXT,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  excerpt TEXT,
  content_json JSONB,
  content_html TEXT NOT NULL DEFAULT '',
  content_text TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public','unlisted','private')),
  featured_image_url TEXT,
  featured_image_alt TEXT,
  meta_title TEXT,
  meta_description TEXT,
  canonical_url TEXT,
  reading_time_minutes INT NOT NULL DEFAULT 0,
  word_count INT NOT NULL DEFAULT 0,
  view_count INT NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_pinned BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMPTZ,
  scheduled_at TIMESTAMPTZ,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.blog_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT '#6366f1',
  post_count INT NOT NULL DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.blog_post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES public.blog_posts(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.blog_tags(id) ON DELETE CASCADE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_blog_post_tags_post_tag UNIQUE (post_id, tag_id)
);

CREATE TABLE public.blog_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  width INT,
  height INT,
  alt_text TEXT,
  caption TEXT,
  used_in_post_id UUID REFERENCES public.blog_posts(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  source_path TEXT NOT NULL DEFAULT '/',
  status TEXT NOT NULL DEFAULT 'subscribed' CHECK (status IN ('subscribed','unsubscribed')),
  notes JSONB NOT NULL DEFAULT '{}'::jsonb,
  subscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  channel TEXT NOT NULL DEFAULT 'push',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL,
  old_data JSONB,
  new_data JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_hub_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'in_app',
  telegram_message_id BIGINT,
  raw_input TEXT NOT NULL,
  ai_response JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  tokens_used INT,
  latency_ms INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF to_regclass('public.categories') IS NULL THEN
    RAISE EXCEPTION 'public.categories is missing before item_categories creation. Run the full migration from the first line, not a selected SQL fragment.';
  END IF;
END;
$$;

CREATE TABLE public.item_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL,
  item_type TEXT NOT NULL CHECK (item_type IN ('brain_note','task','academic_vault','calendar_event')),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_item_categories_item_category UNIQUE (item_id, item_type, category_id)
);

CREATE INDEX idx_categories_user_name_active ON public.categories (user_id, lower(name)) WHERE is_deleted = false;
CREATE INDEX idx_tasks_user_status ON public.tasks (user_id, status) WHERE is_deleted = false;
CREATE INDEX idx_tasks_user_priority ON public.tasks (user_id, priority) WHERE is_deleted = false;
CREATE INDEX idx_brain_notes_user_role ON public.brain_notes (user_id, contextual_role) WHERE is_deleted = false;
CREATE INDEX idx_calendar_events_user_start ON public.calendar_events (user_id, start_at) WHERE is_deleted = false;
CREATE INDEX idx_public_holidays_country_date ON public.public_holidays (country_code, holiday_date);
CREATE INDEX idx_public_holidays_date ON public.public_holidays (holiday_date);
CREATE INDEX idx_vault_user_type ON public.academic_vault_items (user_id, document_type) WHERE is_deleted = false;
CREATE INDEX idx_notifications_scheduled ON public.notifications (scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_audit_logs_table_record ON public.audit_logs (table_name, record_id);
CREATE INDEX idx_ai_hub_logs_user_created ON public.ai_hub_logs (user_id, created_at DESC);
CREATE INDEX idx_item_categories_item ON public.item_categories (item_id, item_type);
CREATE INDEX idx_item_categories_category ON public.item_categories (category_id);
CREATE INDEX idx_blog_posts_user_status ON public.blog_posts (user_id, status) WHERE is_deleted = false;
CREATE INDEX idx_blog_tags_user_active ON public.blog_tags (user_id) WHERE is_deleted = false;
CREATE INDEX idx_blog_media_user_active ON public.blog_media (user_id) WHERE is_deleted = false;
CREATE INDEX idx_newsletter_subscribers_status ON public.newsletter_subscribers (status, subscribed_at DESC);
CREATE INDEX idx_newsletter_subscribers_source ON public.newsletter_subscribers (source_path);

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed_user_id UUID;
  changed_record_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    changed_user_id := OLD.user_id;
    changed_record_id := OLD.id;
  ELSE
    changed_user_id := NEW.user_id;
    changed_record_id := NEW.id;
  END IF;

  INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_data, new_data)
  VALUES (
    changed_user_id,
    TG_TABLE_NAME,
    changed_record_id,
    lower(TG_OP),
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_auth_user_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  derived_full_name TEXT;
BEGIN
  derived_full_name := COALESCE(
    NULLIF(NEW.raw_user_meta_data->>'full_name', ''),
    NULLIF(NEW.raw_user_meta_data->>'name', ''),
    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
    'User'
  );

  INSERT INTO public.users (id, email, full_name)
  VALUES (NEW.id, COALESCE(NEW.email, ''), derived_full_name)
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = CASE
      WHEN public.users.full_name IS NULL OR btrim(public.users.full_name) = '' THEN EXCLUDED.full_name
      ELSE public.users.full_name
    END,
    updated_at = now();

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_brain_notes_updated_at BEFORE UPDATE ON public.brain_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_habits_updated_at BEFORE UPDATE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_public_holidays_updated_at BEFORE UPDATE ON public.public_holidays FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_vault_updated_at BEFORE UPDATE ON public.academic_vault_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_blog_posts_updated_at BEFORE UPDATE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_blog_tags_updated_at BEFORE UPDATE ON public.blog_tags FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_blog_media_updated_at BEFORE UPDATE ON public.blog_media FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_newsletter_subscribers_updated_at BEFORE UPDATE ON public.newsletter_subscribers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER trg_ai_hub_logs_updated_at BEFORE UPDATE ON public.ai_hub_logs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_tasks_audit AFTER INSERT OR UPDATE OR DELETE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER trg_brain_notes_audit AFTER INSERT OR UPDATE OR DELETE ON public.brain_notes FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER trg_habits_audit AFTER INSERT OR UPDATE OR DELETE ON public.habits FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER trg_calendar_events_audit AFTER INSERT OR UPDATE OR DELETE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER trg_vault_audit AFTER INSERT OR UPDATE OR DELETE ON public.academic_vault_items FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();
CREATE TRIGGER trg_blog_posts_audit AFTER INSERT OR UPDATE OR DELETE ON public.blog_posts FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn();

CREATE TRIGGER on_auth_user_upsert
AFTER INSERT OR UPDATE OF email, raw_user_meta_data ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_upsert();

INSERT INTO public.users (id, email, full_name)
SELECT
  auth_users.id,
  COALESCE(auth_users.email, ''),
  COALESCE(
    NULLIF(auth_users.raw_user_meta_data->>'full_name', ''),
    NULLIF(auth_users.raw_user_meta_data->>'name', ''),
    NULLIF(split_part(COALESCE(auth_users.email, ''), '@', 1), ''),
    'User'
  )
FROM auth.users AS auth_users
LEFT JOIN public.users AS public_users
  ON public_users.id = auth_users.id
WHERE public_users.id IS NULL
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = CASE
    WHEN public.users.full_name IS NULL OR btrim(public.users.full_name) = '' THEN EXCLUDED.full_name
    ELSE public.users.full_name
  END,
  updated_at = now();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.habit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academic_vault_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blog_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_hub_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.item_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON public.users FOR SELECT TO authenticated USING ((SELECT auth.uid()) = id);
CREATE POLICY users_insert_own ON public.users FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = id);
CREATE POLICY users_update_own ON public.users FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = id) WITH CHECK ((SELECT auth.uid()) = id);

CREATE POLICY categories_select_own ON public.categories FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY categories_insert_own ON public.categories FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY categories_update_own ON public.categories FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY tasks_select_own ON public.tasks FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY tasks_insert_own ON public.tasks FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY tasks_update_own ON public.tasks FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY brain_notes_select_own ON public.brain_notes FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY brain_notes_insert_own ON public.brain_notes FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY brain_notes_update_own ON public.brain_notes FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY habits_select_own ON public.habits FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY habits_insert_own ON public.habits FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY habits_update_own ON public.habits FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY calendar_events_select_own ON public.calendar_events FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY calendar_events_insert_own ON public.calendar_events FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY calendar_events_update_own ON public.calendar_events FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY public_holidays_read_authenticated ON public.public_holidays FOR SELECT TO authenticated USING (true);
CREATE POLICY public_holidays_read_anon ON public.public_holidays FOR SELECT TO anon USING (true);

CREATE POLICY vault_select_own ON public.academic_vault_items FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY vault_insert_own ON public.academic_vault_items FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY vault_update_own ON public.academic_vault_items FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY blog_posts_select_own ON public.blog_posts FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY blog_posts_insert_own ON public.blog_posts FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY blog_posts_update_own ON public.blog_posts FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY blog_posts_public_read ON public.blog_posts FOR SELECT TO anon, authenticated USING (status = 'published' AND visibility = 'public' AND is_deleted = false);

CREATE POLICY blog_tags_select_own ON public.blog_tags FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY blog_tags_insert_own ON public.blog_tags FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY blog_tags_update_own ON public.blog_tags FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY blog_tags_public_read ON public.blog_tags FOR SELECT TO anon, authenticated USING (is_deleted = false);

CREATE POLICY blog_media_select_own ON public.blog_media FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY blog_media_insert_own ON public.blog_media FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY blog_media_update_own ON public.blog_media FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY notifications_select_own ON public.notifications FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY notifications_insert_own ON public.notifications FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY notifications_update_own ON public.notifications FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY ai_hub_logs_select_own ON public.ai_hub_logs FOR SELECT TO authenticated USING ((SELECT auth.uid()) = user_id);
CREATE POLICY ai_hub_logs_insert_own ON public.ai_hub_logs FOR INSERT TO authenticated WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY ai_hub_logs_update_own ON public.ai_hub_logs FOR UPDATE TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY habit_logs_select_own ON public.habit_logs FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.habits WHERE habits.id = habit_logs.habit_id AND habits.user_id = (SELECT auth.uid())));
CREATE POLICY habit_logs_insert_own ON public.habit_logs FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.habits WHERE habits.id = habit_logs.habit_id AND habits.user_id = (SELECT auth.uid())));
CREATE POLICY habit_logs_update_own ON public.habit_logs FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.habits WHERE habits.id = habit_logs.habit_id AND habits.user_id = (SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.habits WHERE habits.id = habit_logs.habit_id AND habits.user_id = (SELECT auth.uid())));
CREATE POLICY habit_logs_delete_own ON public.habit_logs FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.habits WHERE habits.id = habit_logs.habit_id AND habits.user_id = (SELECT auth.uid())));

CREATE POLICY blog_post_tags_select_own ON public.blog_post_tags FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.blog_posts WHERE blog_posts.id = blog_post_tags.post_id AND blog_posts.user_id = (SELECT auth.uid())));
CREATE POLICY blog_post_tags_insert_own ON public.blog_post_tags FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.blog_posts WHERE blog_posts.id = blog_post_tags.post_id AND blog_posts.user_id = (SELECT auth.uid())));
CREATE POLICY blog_post_tags_update_own ON public.blog_post_tags FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.blog_posts WHERE blog_posts.id = blog_post_tags.post_id AND blog_posts.user_id = (SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.blog_posts WHERE blog_posts.id = blog_post_tags.post_id AND blog_posts.user_id = (SELECT auth.uid())));
CREATE POLICY blog_post_tags_delete_own ON public.blog_post_tags FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.blog_posts WHERE blog_posts.id = blog_post_tags.post_id AND blog_posts.user_id = (SELECT auth.uid())));
CREATE POLICY blog_post_tags_public_read ON public.blog_post_tags FOR SELECT TO anon, authenticated USING (EXISTS (SELECT 1 FROM public.blog_posts WHERE blog_posts.id = blog_post_tags.post_id AND blog_posts.status = 'published' AND blog_posts.visibility = 'public' AND blog_posts.is_deleted = false));

CREATE POLICY item_categories_select_own ON public.item_categories FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.categories WHERE categories.id = item_categories.category_id AND categories.user_id = (SELECT auth.uid())));
CREATE POLICY item_categories_insert_own ON public.item_categories FOR INSERT TO authenticated WITH CHECK (EXISTS (SELECT 1 FROM public.categories WHERE categories.id = item_categories.category_id AND categories.user_id = (SELECT auth.uid())));
CREATE POLICY item_categories_update_own ON public.item_categories FOR UPDATE TO authenticated USING (EXISTS (SELECT 1 FROM public.categories WHERE categories.id = item_categories.category_id AND categories.user_id = (SELECT auth.uid()))) WITH CHECK (EXISTS (SELECT 1 FROM public.categories WHERE categories.id = item_categories.category_id AND categories.user_id = (SELECT auth.uid())));
CREATE POLICY item_categories_delete_own ON public.item_categories FOR DELETE TO authenticated USING (EXISTS (SELECT 1 FROM public.categories WHERE categories.id = item_categories.category_id AND categories.user_id = (SELECT auth.uid())));

CREATE POLICY audit_logs_owner_read ON public.audit_logs FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

SELECT 'personal_dashboard_schema_rebuild_complete' AS status;

COMMIT;
