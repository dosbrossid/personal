-- ============================================================
-- Schedule notification dispatch via Supabase Cron (pg_cron)
-- Replaces the old Vercel Hobby cron approach.
--
-- Before running:
-- 1. Enable pg_cron, pg_net, and Vault in your Supabase project.
-- 2. Store these secrets in Supabase Vault:
--    - personal_dashboard_project_url
--      Example: https://app.zmaula.web.id
--      or       https://your-project-name.vercel.app
--    - personal_dashboard_cron_secret
--      Must match CRON_SECRET in Vercel project env vars.
-- ============================================================

-- Optional helpers, run once if the secrets do not exist yet:
-- select vault.create_secret('https://app.zmaula.web.id', 'personal_dashboard_project_url');
-- select vault.create_secret('replace-with-your-cron-secret', 'personal_dashboard_cron_secret');

-- Remove the old job if it already exists.
select cron.unschedule('dispatch-notifications-every-5-minutes')
where exists (
  select 1
  from cron.job
  where jobname = 'dispatch-notifications-every-5-minutes'
);

-- Schedule the dispatcher every 5 minutes.
select
  cron.schedule(
    'dispatch-notifications-every-5-minutes',
    '*/5 * * * *',
    $$
    select
      net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'personal_dashboard_project_url'
        ) || '/api/cron/notifications',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'personal_dashboard_cron_secret'
          )
        ),
        body := jsonb_build_object(
          'source', 'supabase-cron',
          'triggered_at', now()
        )
      ) as request_id;
    $$
  );

-- Inspect the active job:
select jobid, jobname, schedule, active
from cron.job
where jobname = 'dispatch-notifications-every-5-minutes';
