-- ============================================================
-- Personal Dashboard - Backfill public.users for existing auth user
-- Run this in Supabase SQL Editor after the auth user exists.
-- ============================================================

INSERT INTO public.users (id, email, full_name)
SELECT
  auth_users.id,
  auth_users.email,
  COALESCE(
    NULLIF(auth_users.raw_user_meta_data->>'full_name', ''),
    split_part(auth_users.email, '@', 1)
  ) AS full_name
FROM auth.users AS auth_users
WHERE lower(auth_users.email) = lower('dobrossco@gmail.com')
ON CONFLICT (id) DO UPDATE
SET
  email = EXCLUDED.email,
  full_name = COALESCE(NULLIF(public.users.full_name, ''), EXCLUDED.full_name),
  updated_at = now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE lower(email) = lower('dobrossco@gmail.com')
  ) THEN
    RAISE EXCEPTION 'Auth user dobrossco@gmail.com tidak ditemukan. Pastikan email sudah ada di Authentication > Users.';
  END IF;
END;
$$;

SELECT id, email, full_name, created_at, updated_at
FROM public.users
WHERE lower(email) = lower('dobrossco@gmail.com');
