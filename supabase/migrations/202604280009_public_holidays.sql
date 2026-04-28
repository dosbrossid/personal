BEGIN;

CREATE TABLE IF NOT EXISTS public.public_holidays (
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

CREATE INDEX IF NOT EXISTS idx_public_holidays_country_date
  ON public.public_holidays (country_code, holiday_date);

CREATE INDEX IF NOT EXISTS idx_public_holidays_date
  ON public.public_holidays (holiday_date);

ALTER TABLE public.public_holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS public_holidays_read_authenticated ON public.public_holidays;
DROP POLICY IF EXISTS public_holidays_read_anon ON public.public_holidays;

CREATE POLICY public_holidays_read_authenticated
  ON public.public_holidays
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY public_holidays_read_anon
  ON public.public_holidays
  FOR SELECT
  TO anon
  USING (true);

DROP TRIGGER IF EXISTS trg_public_holidays_updated_at ON public.public_holidays;

CREATE TRIGGER trg_public_holidays_updated_at
  BEFORE UPDATE ON public.public_holidays
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

COMMIT;
