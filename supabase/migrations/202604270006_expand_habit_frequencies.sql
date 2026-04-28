ALTER TABLE public.habits
  ADD COLUMN IF NOT EXISTS cadence_mode TEXT,
  ADD COLUMN IF NOT EXISTS cadence_config JSONB NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'habits'
      AND column_name = 'frequency'
  ) THEN
    EXECUTE $sql$
      UPDATE public.habits
      SET
        cadence_mode = CASE frequency
          WHEN 'daily' THEN 'daily'
          WHEN 'weekdays' THEN 'specific_days'
          WHEN 'weekly' THEN 'weekly_target'
          WHEN 'monthly' THEN 'monthly_target'
          ELSE COALESCE(cadence_mode, 'daily')
        END,
        cadence_config = CASE frequency
          WHEN 'daily' THEN '{}'::jsonb
          WHEN 'weekdays' THEN '{"days":[1,2,3,4,5]}'::jsonb
          WHEN 'weekly' THEN '{"target":1}'::jsonb
          WHEN 'monthly' THEN '{"target":1}'::jsonb
          ELSE COALESCE(cadence_config, '{}'::jsonb)
        END
    $sql$;
  END IF;
END $$;

UPDATE public.habits
SET cadence_mode = COALESCE(cadence_mode, 'daily');

ALTER TABLE public.habits
  ALTER COLUMN cadence_mode SET DEFAULT 'daily';

ALTER TABLE public.habits
  ALTER COLUMN cadence_mode SET NOT NULL;

ALTER TABLE public.habits
  DROP CONSTRAINT IF EXISTS habits_frequency_check;

ALTER TABLE public.habits
  DROP CONSTRAINT IF EXISTS habits_cadence_mode_check;

ALTER TABLE public.habits
  ADD CONSTRAINT habits_cadence_mode_check
  CHECK (cadence_mode IN ('daily', 'specific_days', 'interval_days', 'weekly_target', 'monthly_target'));

ALTER TABLE public.habits
  DROP COLUMN IF EXISTS frequency;
