-- Create cron job for automatic source channel sync
-- Runs every 30 minutes to fetch new posts from source channels

SELECT cron.schedule(
  'sync-source-channels-cron',
  '*/30 * * * *', -- Every 30 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/sync-all-sources',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify
SELECT * FROM cron.job WHERE jobname = 'sync-source-channels-cron';
