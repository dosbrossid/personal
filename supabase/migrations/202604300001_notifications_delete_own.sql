DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'notifications'
      AND policyname = 'notifications_delete_own'
  ) THEN
    CREATE POLICY notifications_delete_own
      ON public.notifications
      FOR DELETE
      TO authenticated
      USING ((SELECT auth.uid()) = user_id);
  END IF;
END $$;

SELECT 'personal_dashboard_notifications_delete_own_policy_complete' AS status;
