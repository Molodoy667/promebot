-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Unschedule old job if exists
SELECT cron.unschedule('ai-bot-worker-cron');

-- Create cron job to run ai-bot-worker every minute
SELECT cron.schedule(
  'ai-bot-worker-cron',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := current_setting('app.settings.supabase_url', true) || '/functions/v1/ai-bot-worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
      ),
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify cron job created
SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname
FROM cron.job 
WHERE jobname = 'ai-bot-worker-cron';
