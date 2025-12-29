-- Автоматичне очищення старих постів БЕЗ КРОНА
-- Використовує тригер на INSERT нових постів

-- 1. Створюємо таблицю для відстеження останнього очищення
CREATE TABLE IF NOT EXISTS public.cleanup_tracker (
  id INTEGER PRIMARY KEY DEFAULT 1,
  last_cleanup_at TIMESTAMPTZ DEFAULT NOW(),
  posts_deleted_last_time INTEGER DEFAULT 0,
  CONSTRAINT single_row CHECK (id = 1)
);

-- Вставляємо початковий запис
INSERT INTO public.cleanup_tracker (id, last_cleanup_at, posts_deleted_last_time)
VALUES (1, NOW(), 0)
ON CONFLICT (id) DO NOTHING;

-- 2. Функція для автоматичного очищення
CREATE OR REPLACE FUNCTION public.auto_cleanup_old_posts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  days_since_last_cleanup INTEGER;
  plagiarist_deleted INTEGER := 0;
  ai_deleted INTEGER := 0;
  cutoff_date TIMESTAMPTZ;
BEGIN
  -- Перевіряємо, чи минуло 30 днів з останнього очищення
  SELECT EXTRACT(DAY FROM (NOW() - last_cleanup_at))::INTEGER
  INTO days_since_last_cleanup
  FROM public.cleanup_tracker
  WHERE id = 1;
  
  -- Якщо минуло >= 30 днів, виконуємо очищення
  IF days_since_last_cleanup >= 30 THEN
    
    RAISE NOTICE '🗑️ Auto cleanup triggered - last cleanup was % days ago', days_since_last_cleanup;
    
    cutoff_date := NOW() - INTERVAL '30 days';
    
    -- Очищуємо plagiarist пости
    WITH deleted AS (
      DELETE FROM posts_history
      WHERE created_at < cutoff_date
      AND status IN ('published', 'success', 'failed')
      RETURNING id
    )
    SELECT COUNT(*) INTO plagiarist_deleted FROM deleted;
    
    -- Очищуємо AI пости
    WITH deleted AS (
      DELETE FROM ai_generated_posts
      WHERE created_at < cutoff_date
      AND status IN ('published', 'failed')
      RETURNING id
    )
    SELECT COUNT(*) INTO ai_deleted FROM deleted;
    
    -- Оновлюємо трекер
    UPDATE public.cleanup_tracker
    SET 
      last_cleanup_at = NOW(),
      posts_deleted_last_time = plagiarist_deleted + ai_deleted
    WHERE id = 1;
    
    RAISE NOTICE '✅ Auto cleanup completed: % plagiarist + % AI = % total posts deleted', 
      plagiarist_deleted, ai_deleted, (plagiarist_deleted + ai_deleted);
    
  END IF;
  
  RETURN NEW;
END;
$$;

-- 3. Створюємо тригери на INSERT нових постів
-- Тригер спрацьовує при додаванні нового поста і перевіряє чи потрібно очищення

-- Тригер для posts_history (plagiarist)
DROP TRIGGER IF EXISTS trigger_auto_cleanup_plagiarist ON posts_history;
CREATE TRIGGER trigger_auto_cleanup_plagiarist
  AFTER INSERT ON posts_history
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.auto_cleanup_old_posts();

-- Тригер для ai_generated_posts (AI bot)
DROP TRIGGER IF EXISTS trigger_auto_cleanup_ai ON ai_generated_posts;
CREATE TRIGGER trigger_auto_cleanup_ai
  AFTER INSERT ON ai_generated_posts
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.auto_cleanup_old_posts();

-- 4. Функція для ручного запуску (опціонально)
CREATE OR REPLACE FUNCTION public.force_cleanup_old_posts()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  plagiarist_deleted INTEGER := 0;
  ai_deleted INTEGER := 0;
  cutoff_date TIMESTAMPTZ;
BEGIN
  cutoff_date := NOW() - INTERVAL '30 days';
  
  -- Очищуємо plagiarist пости
  WITH deleted AS (
    DELETE FROM posts_history
    WHERE created_at < cutoff_date
    AND status IN ('published', 'success', 'failed')
    RETURNING id
  )
  SELECT COUNT(*) INTO plagiarist_deleted FROM deleted;
  
  -- Очищуємо AI пости
  WITH deleted AS (
    DELETE FROM ai_generated_posts
    WHERE created_at < cutoff_date
    AND status IN ('published', 'failed')
    RETURNING id
  )
  SELECT COUNT(*) INTO ai_deleted FROM deleted;
  
  -- Оновлюємо трекер
  UPDATE public.cleanup_tracker
  SET 
    last_cleanup_at = NOW(),
    posts_deleted_last_time = plagiarist_deleted + ai_deleted
  WHERE id = 1;
  
  RETURN json_build_object(
    'success', true,
    'deleted', json_build_object(
      'plagiarist', plagiarist_deleted,
      'ai', ai_deleted,
      'total', plagiarist_deleted + ai_deleted
    ),
    'cutoffDate', cutoff_date,
    'nextCleanup', NOW() + INTERVAL '30 days'
  );
END;
$$;

-- Надаємо права
GRANT SELECT ON public.cleanup_tracker TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_cleanup_old_posts() TO authenticated;
GRANT EXECUTE ON FUNCTION public.force_cleanup_old_posts() TO service_role;

-- Перегляд статусу останнього очищення
COMMENT ON TABLE public.cleanup_tracker IS 'Відстежує останнє автоматичне очищення старих постів';
COMMENT ON FUNCTION public.auto_cleanup_old_posts() IS 'Автоматично очищує пости старіші за 30 днів при додаванні нових постів';
COMMENT ON FUNCTION public.force_cleanup_old_posts() IS 'Примусово запускає очищення старих постів (ручний запуск)';
