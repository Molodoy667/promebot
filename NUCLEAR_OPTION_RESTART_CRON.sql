-- ☢️ ЯДЕРНИЙ ВАРІАНТ: ПОВНЕ ПЕРЕЗАВАНТАЖЕННЯ pg_cron
-- ВИКОНАТИ В SUPABASE DASHBOARD → SQL EDITOR

-- КРОК 1: Видалити ВСІ cron jobs
DO $$
DECLARE
  job_rec RECORD;
BEGIN
  FOR job_rec IN SELECT jobname FROM cron.job
  LOOP
    PERFORM cron.unschedule(job_rec.jobname);
    RAISE NOTICE 'Deleted: %', job_rec.jobname;
  END LOOP;
END $$;

-- КРОК 2: Перевірити що все видалено
SELECT COUNT(*) as remaining_cron_jobs FROM cron.job;

-- КРОК 3: Видалити і перезавантажити extension
DROP EXTENSION IF EXISTS pg_cron CASCADE;
CREATE EXTENSION pg_cron;

-- КРОК 4: Створити ВСІ cron jobs заново

-- 1. Expire subscriptions (кожні 10 хв)
SELECT cron.schedule(
  'expire-subscriptions-job',
  '*/10 * * * *',
  $$
  SELECT
    net.http_post(
      url:='https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/expire-subscriptions',
      headers:='{"Content-Type": "application/json"}'::jsonb,
      body:='{}'::jsonb
    ) as request_id;
  $$
);

-- 2. Lottery auto draw (кожні 5 хв)
SELECT cron.schedule(
  'lottery-auto-draw-check',
  '*/5 * * * *',
  'SELECT auto_draw_lottery();'
);

-- 3. Sync source channels (кожні 30 хв)
SELECT cron.schedule(
  'sync-source-channels-cron',
  '*/30 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/sync-all-sources',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- 4. AI Bot Worker (КОЖНІ 5 ХВИЛИН!)
SELECT cron.schedule(
  'ai-bot-worker-final',
  '*/5 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/ai-bot-worker',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);

-- КРОК 5: Перевірити що створилось
SELECT 
  jobid,
  jobname, 
  schedule, 
  active
FROM cron.job
ORDER BY jobid;

-- ОЧІКУВАНИЙ РЕЗУЛЬТАТ: 4 jobs, всі з правильним розкладом
