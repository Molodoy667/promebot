-- ВИКОНАТИ В SUPABASE DASHBOARD → DATABASE → SQL EDITOR
-- ЦЕ ВИДАЛИТЬ ВСІ CRON JOBS

-- Крок 1: Подивитись всі cron jobs
SELECT jobid, jobname, schedule, active, command
FROM cron.job;

-- Крок 2: ВИДАЛИТИ ВСІ (будьте обережні!)
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

-- Крок 3: Перевірити що все видалено
SELECT COUNT(*) as remaining_jobs FROM cron.job;

-- Крок 4: Створити ОДИН новий з кожні 5 хвилин
SELECT cron.schedule(
  'ai-worker-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/ai-bot-worker',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- Крок 5: Фінальна перевірка
SELECT jobid, jobname, schedule, active
FROM cron.job;
