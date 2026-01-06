-- Setup cron job for auto-sync-stats
-- This will run every 15 minutes to collect channel statistics via MTProto

-- Enable pg_cron extension if not enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove old cron jobs if exist
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname = 'auto-sync-stats-job';

-- Create new cron job to call Edge Function every 15 minutes
SELECT cron.schedule(
    'auto-sync-stats-job',
    '*/15 * * * *', -- Every 15 minutes
    $$
    SELECT
      net.http_post(
          url:='https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/auto-sync-stats',
          headers:='{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.settings.service_role_key') || '"}'::jsonb,
          body:='{}'::jsonb
      ) as request_id;
    $$
);

-- Grant necessary permissions
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA cron TO postgres;
