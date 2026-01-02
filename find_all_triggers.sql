-- ВИКОНАТИ В SUPABASE DASHBOARD → SQL EDITOR
-- Знайти ВСІ тригери які можуть викликати ai-bot-worker

-- 1. ВСІ CRON JOBS
SELECT 
  jobid,
  jobname, 
  schedule, 
  active,
  command
FROM cron.job
ORDER BY jobid;

-- 2. ВСІ DATABASE TRIGGERS
SELECT 
  trigger_schema,
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE action_statement LIKE '%ai-bot-worker%'
   OR action_statement LIKE '%http_post%';

-- 3. ВСІ REALTIME SUBSCRIPTIONS (якщо є)
SELECT * FROM pg_publication;

-- 4. ВСІ SCHEDULED EVENTS (якщо є)
SELECT * FROM pg_stat_activity 
WHERE query LIKE '%ai-bot-worker%';
