-- Create cron job for auto-syncing channel statistics every 5 minutes
-- First, ensure pg_cron extension is enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old job if exists
SELECT cron.unschedule('auto-sync-channel-stats');

-- Schedule new job: every 5 minutes
SELECT cron.schedule(
  'auto-sync-channel-stats',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.api_url') || '/functions/v1/auto-sync-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Cron scheduler for PostgreSQL';
