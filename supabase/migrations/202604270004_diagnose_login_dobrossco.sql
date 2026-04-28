-- ============================================================
-- Personal Dashboard - Diagnose login for dobrossco@gmail.com
-- Run this in Supabase SQL Editor.
-- ============================================================

SELECT
  auth_users.id,
  auth_users.email,
  auth_users.email_confirmed_at IS NOT NULL AS email_confirmed,
  auth_users.encrypted_password IS NOT NULL
    AND auth_users.encrypted_password <> '' AS has_password,
  auth_users.created_at AS auth_created_at,
  public_users.id IS NOT NULL AS has_public_user,
  public_users.full_name,
  public_users.created_at AS public_user_created_at
FROM auth.users AS auth_users
LEFT JOIN public.users AS public_users
  ON public_users.id = auth_users.id
WHERE lower(auth_users.email) = lower('dobrossco@gmail.com');

-- Kalau query di atas kosong, user belum ada di Authentication > Users.
-- Kalau email_confirmed = false, confirm email user di Supabase Dashboard.
-- Kalau has_password = false, user dibuat via invite/OAuth dan belum punya password.
