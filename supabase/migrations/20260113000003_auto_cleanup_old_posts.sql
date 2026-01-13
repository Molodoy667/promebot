-- Автоматичне видалення старих постів (залишає останні 100 для кожного сервісу)
-- Лічильник публікацій НЕ зменшується, бо він зберігається в bot_global_stats

-- Функція для очищення старих posts_history (плагіат-боти)
CREATE OR REPLACE FUNCTION cleanup_old_posts_history()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM posts_history
  WHERE id IN (
    SELECT id FROM (
      SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY bot_service_id ORDER BY created_at DESC) as row_num
      FROM posts_history
      WHERE status = 'published'
    ) ranked
    WHERE row_num > 100
  );
  RAISE NOTICE 'Cleaned up old posts_history';
END;
$$;

-- Функція для очищення старих ai_generated_posts (AI-боти)
CREATE OR REPLACE FUNCTION cleanup_old_ai_posts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM ai_generated_posts
  WHERE id IN (
    SELECT id FROM (
      SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY ai_bot_service_id ORDER BY created_at DESC) as row_num
      FROM ai_generated_posts
      WHERE status = 'published'
    ) ranked
    WHERE row_num > 100
  );
  RAISE NOTICE 'Cleaned up old ai_generated_posts';
END;
$$;

-- Видаляємо старі cron jobs якщо існують
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-posts-history');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-ai-posts');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Створюємо cron jobs (щодня о 4:00 ночі)
SELECT cron.schedule(
  'cleanup-old-posts-history',
  '0 4 * * *',
  $$SELECT cleanup_old_posts_history();$$
);

SELECT cron.schedule(
  'cleanup-old-ai-posts',
  '0 4 * * *',
  $$SELECT cleanup_old_ai_posts();$$
);

COMMENT ON FUNCTION cleanup_old_posts_history IS 'Очищує старі пости плагіат-ботів - залишає останні 100 для кожного сервісу';
COMMENT ON FUNCTION cleanup_old_ai_posts IS 'Очищує старі пости AI-ботів - залишає останні 100 для кожного сервісу';
