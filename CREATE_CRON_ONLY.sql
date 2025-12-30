-- CREATE CRON JOB (без unschedule)
-- https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/sql/new

SELECT cron.schedule(
  'ai-bot-worker-cron',
  '* * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/ai-bot-worker',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify
SELECT * FROM cron.job WHERE jobname = 'ai-bot-worker-cron';
