# 🕐 Налаштування Cron для AI Bot Worker

## Проблема
AIBot Worker не викликається автоматично, тому генерація постів кожні 10 хвилин не працює.

## Рішення

### Варіант 1: Supabase Dashboard (рекомендовано)

1. Відкрийте **Supabase Dashboard**
2. Перейдіть: **Project Settings → Database → Cron Jobs**
3. Натисніть **Create a new cron job**
4. Заповніть форму:

```
Name: ai-bot-worker
Schedule: * * * * * (кожну хвилину)
SQL Query:
```

```sql
SELECT
  net.http_post(
    url := 'https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/ai-bot-worker',
    headers := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c"}'::jsonb,
    body := '{}'::jsonb
  ) as request_id;
```

5. Збережіть

### Варіант 2: Тимчасовий скрипт (для розробки)

Запустіть скрипт, який викликає worker кожну хвилину:

```bash
node scripts/tmp_rovodev_run_worker_loop.js
```

## Як працює

1. **Cron запускається кожну хвилину**
2. **ai-bot-worker перевіряє:**
   - Активні AI сервіси (`is_running = true`)
   - Кількість scheduled постів (макс 10)
   - Чи пройшло >= 10 хв з моменту останнього згенерованого поста
3. **Якщо умови виконані:**
   - Викликає `generate-ai-posts` для генерації 1 поста
4. **Публікація:**
   - Worker знаходить найстаріший `scheduled` пост
   - Публікує його в Telegram

## Перевірка

```bash
# Подивитись останні пости
node scripts/tmp_rovodev_check_cron.js

# Запустити worker вручну
node scripts/tmp_rovodev_apply_cron.js
```

## Важливо

- Worker працює ТІЛЬКИ якщо є активні категорії в `ai_content_sources`
- Інтервал генерації: **10 хвилин** (жорстко закодовано в worker)
- Інтервал публікації: з налаштувань `post_interval_minutes`
