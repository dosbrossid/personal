ALTER TABLE public.calendar_events
  ADD COLUMN IF NOT EXISTS reminder_config JSONB NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.calendar_events
SET reminder_config = CASE
  WHEN reminder_minutes IS NULL THEN '[]'::jsonb
  ELSE jsonb_build_array(
    jsonb_build_object(
      'type', 'before_minutes',
      'minutes', reminder_minutes
    )
  )
END
WHERE reminder_config = '[]'::jsonb;
