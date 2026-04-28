-- ============================================================
-- Personal Dashboard - Sync auth.users to public.users
-- Ensures every Supabase Auth user has an application profile row.
-- ============================================================

BEGIN;

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

DROP TRIGGER IF EXISTS on_auth_user_upsert ON auth.users;

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

COMMIT;
