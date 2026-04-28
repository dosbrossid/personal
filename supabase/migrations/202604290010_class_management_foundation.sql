BEGIN;

CREATE TABLE IF NOT EXISTS public.class_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  course_code TEXT,
  semester_label TEXT,
  meeting_target INT NOT NULL CHECK (meeting_target IN (8, 16)),
  student_count INT NOT NULL DEFAULT 0 CHECK (student_count >= 0),
  default_day_of_week INT CHECK (default_day_of_week BETWEEN 0 AND 6),
  default_start_time TIME,
  default_end_time TIME,
  location TEXT,
  contextual_role TEXT NOT NULL DEFAULT 'dosen' CHECK (contextual_role IN ('dosen','creator','affiliate','consultant','general')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  notes TEXT,
  assignment_count INT NOT NULL DEFAULT 0 CHECK (assignment_count >= 0),
  completed_meeting_count INT NOT NULL DEFAULT 0 CHECK (completed_meeting_count >= 0 AND completed_meeting_count <= meeting_target),
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.class_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  class_course_id UUID NOT NULL REFERENCES public.class_courses(id) ON DELETE CASCADE,
  meeting_number INT NOT NULL CHECK (meeting_number >= 1),
  title TEXT NOT NULL DEFAULT '',
  description TEXT,
  session_date DATE NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'completed', 'canceled', 'rescheduled')),
  attendance_count INT NOT NULL DEFAULT 0 CHECK (attendance_count >= 0),
  assignment_given BOOLEAN NOT NULL DEFAULT false,
  assignment_title TEXT,
  assignment_due_at TIMESTAMPTZ,
  reflection_note TEXT,
  calendar_event_id UUID REFERENCES public.calendar_events(id) ON DELETE SET NULL,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_class_sessions_meeting UNIQUE (class_course_id, meeting_number),
  CONSTRAINT chk_class_session_end_after_start CHECK (end_at IS NULL OR end_at > start_at),
  CONSTRAINT chk_class_assignment_due_after_start CHECK (assignment_due_at IS NULL OR assignment_due_at > start_at)
);

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS origin TEXT NOT NULL DEFAULT 'manual';

ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_calendar_events_origin'
  ) THEN
    ALTER TABLE public.calendar_events
      ADD CONSTRAINT chk_calendar_events_origin
      CHECK (origin IN ('manual', 'ai', 'class_management', 'holiday'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_class_courses_user_status
  ON public.class_courses (user_id, status)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_class_courses_semester
  ON public.class_courses (user_id, semester_label)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_class_sessions_course
  ON public.class_sessions (class_course_id, meeting_number)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_class_sessions_schedule
  ON public.class_sessions (user_id, start_at)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_calendar_events_origin
  ON public.calendar_events (origin, start_at)
  WHERE is_deleted = false;

CREATE OR REPLACE FUNCTION public.refresh_class_course_metrics()
RETURNS TRIGGER AS $$
DECLARE
  old_course_id UUID;
  new_course_id UUID;
BEGIN
  old_course_id := CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN OLD.class_course_id ELSE NULL END;
  new_course_id := CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN NEW.class_course_id ELSE NULL END;

  IF old_course_id IS NOT NULL THEN
    UPDATE public.class_courses AS cc
    SET
      completed_meeting_count = (
        SELECT COUNT(*)
        FROM public.class_sessions AS cs
        WHERE cs.class_course_id = old_course_id
          AND cs.is_deleted = false
          AND cs.status = 'completed'
      ),
      assignment_count = (
        SELECT COUNT(*)
        FROM public.class_sessions AS cs
        WHERE cs.class_course_id = old_course_id
          AND cs.is_deleted = false
          AND cs.assignment_given = true
      ),
      updated_at = now()
    WHERE cc.id = old_course_id;
  END IF;

  IF new_course_id IS NOT NULL AND new_course_id IS DISTINCT FROM old_course_id THEN
    UPDATE public.class_courses AS cc
    SET
      completed_meeting_count = (
        SELECT COUNT(*)
        FROM public.class_sessions AS cs
        WHERE cs.class_course_id = new_course_id
          AND cs.is_deleted = false
          AND cs.status = 'completed'
      ),
      assignment_count = (
        SELECT COUNT(*)
        FROM public.class_sessions AS cs
        WHERE cs.class_course_id = new_course_id
          AND cs.is_deleted = false
          AND cs.assignment_given = true
      ),
      updated_at = now()
    WHERE cc.id = new_course_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE public.class_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS own_data ON public.class_courses;
DROP POLICY IF EXISTS own_data ON public.class_sessions;

CREATE POLICY own_data
  ON public.class_courses
  FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY own_data
  ON public.class_sessions
  FOR ALL
  USING (user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_class_courses_updated_at ON public.class_courses;
DROP TRIGGER IF EXISTS trg_class_sessions_updated_at ON public.class_sessions;
DROP TRIGGER IF EXISTS trg_class_sessions_metrics ON public.class_sessions;

CREATE TRIGGER trg_class_courses_updated_at
  BEFORE UPDATE ON public.class_courses
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_class_sessions_updated_at
  BEFORE UPDATE ON public.class_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER trg_class_sessions_metrics
  AFTER INSERT OR UPDATE OR DELETE ON public.class_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.refresh_class_course_metrics();

COMMIT;
