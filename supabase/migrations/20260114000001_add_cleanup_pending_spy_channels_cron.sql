-- Create cron job to cleanup pending spy channels every minute
SELECT cron.schedule(
  'cleanup-pending-spy-channels',
  '* * * * *', -- Every minute
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL') || '/functions/v1/cleanup-pending-spy-channels',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);

COMMENT ON CRON JOB 'cleanup-pending-spy-channels' IS 'Auto-leave channels that spy joined for verification but user did not confirm within 5 minutes';
