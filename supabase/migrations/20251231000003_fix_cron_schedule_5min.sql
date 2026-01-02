-- Fix ai-bot-worker cron to run every 5 minutes instead of every minute

-- Remove all existing ai-bot-worker cron jobs
DO $$
DECLARE
  job_record RECORD;
BEGIN
  FOR job_record IN 
    SELECT jobname FROM cron.job WHERE jobname LIKE '%ai-bot-worker%'
  LOOP
    PERFORM cron.unschedule(job_record.jobname);
    RAISE NOTICE 'Unscheduled job: %', job_record.jobname;
  END LOOP;
END $$;

-- Create new cron job with 5 minute interval
SELECT cron.schedule(
  'ai-bot-worker-cron-v2',
  '*/5 * * * *',  -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/ai-bot-worker',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- Verify the new cron job
SELECT 
  jobid, 
  jobname, 
  schedule, 
  active,
  CASE 
    WHEN schedule = '*/5 * * * *' THEN '✓ Correct: Every 5 minutes'
    ELSE '✗ Incorrect schedule'
  END as status
FROM cron.job 
WHERE jobname LIKE '%ai-bot-worker%';
