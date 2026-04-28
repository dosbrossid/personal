-- ============================================================
-- Personal Dashboard - Notifications & Telegram indexes
-- Run after 001 initial schema.
-- ============================================================

BEGIN;

CREATE UNIQUE INDEX IF NOT EXISTS uq_users_telegram_chat_id
  ON public.users (telegram_chat_id)
  WHERE telegram_chat_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_hub_logs_telegram_message_id
  ON public.ai_hub_logs (telegram_message_id)
  WHERE telegram_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_user_status
  ON public.notifications (user_id, status, created_at DESC);

SELECT 'personal_dashboard_notifications_telegram_indexes_complete' AS status;

COMMIT;
