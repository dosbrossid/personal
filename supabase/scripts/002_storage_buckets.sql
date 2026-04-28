-- ============================================================
-- Personal Dashboard - Supabase Storage Buckets
-- Run after 001_rebuild_public_schema.sql.
-- Buckets: vault (private), blog-media (public)
-- ============================================================

BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  (
    'vault',
    'vault',
    false,
    52428800,
    ARRAY[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'blog-media',
    'blog-media',
    true,
    10485760,
    ARRAY[
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif'
    ]
  )
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS vault_objects_select_own ON storage.objects;
DROP POLICY IF EXISTS vault_objects_insert_own ON storage.objects;
DROP POLICY IF EXISTS vault_objects_update_own ON storage.objects;
DROP POLICY IF EXISTS vault_objects_delete_own ON storage.objects;
DROP POLICY IF EXISTS blog_media_objects_public_read ON storage.objects;
DROP POLICY IF EXISTS blog_media_objects_insert_own ON storage.objects;
DROP POLICY IF EXISTS blog_media_objects_update_own ON storage.objects;
DROP POLICY IF EXISTS blog_media_objects_delete_own ON storage.objects;

CREATE POLICY vault_objects_select_own
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'vault'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY vault_objects_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vault'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY vault_objects_update_own
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vault'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'vault'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY vault_objects_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'vault'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY blog_media_objects_public_read
ON storage.objects
FOR SELECT
TO anon, authenticated
USING (bucket_id = 'blog-media');

CREATE POLICY blog_media_objects_insert_own
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'blog-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY blog_media_objects_update_own
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'blog-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
)
WITH CHECK (
  bucket_id = 'blog-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

CREATE POLICY blog_media_objects_delete_own
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'blog-media'
  AND (storage.foldername(name))[1] = (SELECT auth.uid()::text)
);

SELECT 'personal_dashboard_storage_buckets_ready' AS status;

COMMIT;
