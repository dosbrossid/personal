-- ============================================================
-- Reset Public Schema Tables
-- Purpose: drop all user-defined tables in schema public
-- Safe target: does NOT touch auth/storage/supabase_migrations schemas
-- Run manually in Supabase SQL Editor before replaying migrations
-- ============================================================

DO $$
DECLARE
  record_item RECORD;
BEGIN
  FOR record_item IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  LOOP
    EXECUTE format('DROP TABLE IF EXISTS public.%I CASCADE;', record_item.tablename);
  END LOOP;
END
$$;

DROP FUNCTION IF EXISTS public.update_updated_at() CASCADE;
DROP FUNCTION IF EXISTS public.audit_trigger_fn() CASCADE;

-- Optional sanity check
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
