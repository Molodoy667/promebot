-- Create cron job to expire subscriptions and VIP every hour
-- This checks for expired tariffs and VIP subscriptions and creates notifications

-- Remove old cron job if exists
SELECT cron.unschedule(jobid) 
FROM cron.job 
WHERE jobname = 'expire-subscriptions-job';

-- Create new cron job to call expire-subscriptions function every hour
SELECT cron.schedule(
  'expire-subscriptions-job',
  '0 * * * *', -- Every hour at minute 0
  $$
  SELECT
    net.http_post(
      url:='https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/expire-subscriptions',
      headers:='{\"Content-Type\": \"application/json\", \"Authorization\": \"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c\"}'::jsonb,
      body:='{}'::jsonb
    ) AS request_id;
  $$
);

COMMENT ON EXTENSION pg_cron IS 'Cron job to expire subscriptions and VIP, runs every hour';
