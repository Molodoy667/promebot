# 🔍 ЯК ЗНАЙТИ ХТО ЗАПУСКАЄ WORKER КОЖНУ ХВИЛИНУ

## Крок 1: Виконати SQL в Dashboard

1. Відкрити: https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/sql/new
2. Скопіювати вміст файлу `find_all_triggers.sql`
3. Натиснути **RUN**
4. Результати покажуть ВСІ тригери

---

## Крок 2: Що шукати

### Секція 1: CRON JOBS
Має бути **ТІЛЬКИ 1** запис:
```
jobname: ai-bot-worker-cron-v2 (або ai-worker-5min)
schedule: */5 * * * *
```

Якщо є ІНШІ записи з `* * * * *` (кожну хвилину) - ЦЕ ПРОБЛЕМА!

### Секція 2: DATABASE TRIGGERS
Має бути **порожньо**. Якщо є записи - це додатковий тригер.

---

## Крок 3: Видалити зайві

Якщо знайдено ЗАЙВІ cron jobs:
```sql
SELECT cron.unschedule('назва_зайвого_job');
```

---

## Альтернатива: Видалити ВСІ і створити 1 новий

```sql
-- ВИДАЛИТИ ВСІ
DO $$
DECLARE
  job_rec RECORD;
BEGIN
  FOR job_rec IN SELECT jobname FROM cron.job
  LOOP
    PERFORM cron.unschedule(job_rec.jobname);
  END LOOP;
END $$;

-- СТВОРИТИ ОДИН ПРАВИЛЬНИЙ
SELECT cron.schedule(
  'ai-worker-final',
  '*/5 * * * *',  -- КОЖНІ 5 ХВИЛИН!
  $$
  SELECT net.http_post(
    url := 'https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/ai-bot-worker',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
  $$
);

-- ПЕРЕВІРИТИ
SELECT jobname, schedule FROM cron.job;
```

---

Виконайте SQL і надішліть результат!
