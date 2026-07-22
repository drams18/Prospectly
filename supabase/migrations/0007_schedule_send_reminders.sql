-- Schedules the `send-reminders` Edge Function to run every minute via
-- pg_cron + pg_net (standard Supabase pattern — works on any hosted
-- project regardless of CLI/dashboard cron-trigger support).
--
-- MANUAL STEP REQUIRED before this actually fires anything: the service
-- role key is never committed to this repo, so it's read from Vault at
-- call time instead of being embedded here. Run this once, with your
-- project's actual service role key (Dashboard → Project Settings → API),
-- via the SQL editor or `supabase secrets`/psql — NOT as a migration:
--
--   select vault.create_secret('<your-service-role-key>', 'service_role_key');
--
-- Until that secret exists, the cron job runs but each call fails auth
-- (harmless — it just retries next minute).

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

select
  cron.schedule(
    'send-reminders-every-minute',
    '* * * * *',
    $$
    select
      net.http_post(
        url := 'https://bqoifkxcbuupipwrmmox.supabase.co/functions/v1/send-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
        ),
        body := '{}'::jsonb
      );
    $$
  )
where not exists (select 1 from cron.job where jobname = 'send-reminders-every-minute');
