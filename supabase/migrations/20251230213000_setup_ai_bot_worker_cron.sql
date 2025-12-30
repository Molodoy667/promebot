-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Unschedule old job if exists
SELECT cron.unschedule('ai-bot-worker-cron');

-- Create cron job to run ai-bot-worker every minute
SELECT cron.schedule(
  'ai-bot-worker-cron',
  '* * * * *', -- Every minute
  $$
  SELECT
    net.http_post(
      url := 'https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/ai-bot-worker',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify cron job created
SELECT jobid, schedule, command, nodename, nodeport, database, username, active, jobname
FROM cron.job 
WHERE jobname = 'ai-bot-worker-cron';
