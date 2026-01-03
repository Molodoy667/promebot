-- ============================================
-- Setup Cron Job for Auto-Syncing Channel Stats
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Remove old job if exists (ignore error if not exists)
DO $$
BEGIN
    PERFORM cron.unschedule('auto-sync-channel-stats');
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Create new cron job: every 5 minutes
SELECT cron.schedule(
  'auto-sync-channel-stats',
  '*/5 * * * *',
  $$
  SELECT extensions.http_post(
    url := 'https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/auto-sync-stats',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Verify cron job was created
SELECT * FROM cron.job WHERE jobname = 'auto-sync-channel-stats';
