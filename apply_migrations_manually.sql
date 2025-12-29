-- Скопіюйте цей SQL в Supabase Dashboard → SQL Editor
-- https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/sql

-- ==========================================
-- МІГРАЦІЯ 1: Додавання колонок до profiles
-- ==========================================

-- Додаємо колонки для кешування статистики до існуючої таблиці profiles
ALTER TABLE public.profiles 
  ADD COLUMN IF NOT EXISTS bots_used_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS channels_used_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sources_used_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS posts_current_period INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stats_period_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS stats_last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Коментарі
COMMENT ON COLUMN public.profiles.bots_used_count IS 'Кількість унікальних ботів користувача';
COMMENT ON COLUMN public.profiles.channels_used_count IS 'Кількість каналів (bot_services + ai_bot_services)';
COMMENT ON COLUMN public.profiles.sources_used_count IS 'Кількість джерельних каналів';
COMMENT ON COLUMN public.profiles.posts_current_period IS 'Пости за поточний період (скидається при зміні тарифу)';
COMMENT ON COLUMN public.profiles.stats_period_start IS 'Початок періоду статистики';
COMMENT ON COLUMN public.profiles.stats_last_updated IS 'Дата останнього оновлення статистики';

-- Індекс для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_profiles_stats_updated ON profiles(stats_last_updated);

-- Функція для оновлення статистики
CREATE OR REPLACE FUNCTION update_user_stats(user_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  bots_count INT := 0;
  channels_count INT := 0;
  sources_count INT := 0;
  posts_count INT := 0;
  period_start TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Отримуємо початок періоду
  SELECT stats_period_start INTO period_start
  FROM profiles
  WHERE id = user_id_param;
  
  IF period_start IS NULL THEN
    period_start := NOW();
  END IF;
  
  -- Рахуємо унікальні боти
  SELECT COUNT(DISTINCT bot_id) INTO bots_count
  FROM (
    SELECT bot_id FROM ai_bot_services WHERE user_id = user_id_param
    UNION
    SELECT bot_id FROM bot_services WHERE user_id = user_id_param LIMIT 1
  ) AS unique_bots;
  
  -- Рахуємо канали
  SELECT 
    COALESCE((SELECT COUNT(*) FROM bot_services WHERE user_id = user_id_param), 0) +
    COALESCE((SELECT COUNT(*) FROM ai_bot_services WHERE user_id = user_id_param), 0)
  INTO channels_count;
  
  -- Рахуємо джерела
  SELECT COUNT(*) INTO sources_count
  FROM source_channels sc
  INNER JOIN bot_services bs ON sc.bot_service_id = bs.id
  WHERE bs.user_id = user_id_param;
  
  -- Рахуємо пости за період
  SELECT 
    COALESCE((
      SELECT COUNT(*) 
      FROM posts_history ph
      INNER JOIN bot_services bs ON ph.bot_service_id = bs.id
      WHERE bs.user_id = user_id_param 
        AND ph.created_at >= period_start
    ), 0) +
    COALESCE((
      SELECT COUNT(*) 
      FROM ai_generated_posts agp
      INNER JOIN ai_bot_services abs ON agp.ai_bot_service_id = abs.id
      WHERE abs.user_id = user_id_param 
        AND agp.created_at >= period_start
    ), 0)
  INTO posts_count;
  
  -- Оновлюємо профіль
  UPDATE profiles SET
    bots_used_count = bots_count,
    channels_used_count = channels_count,
    sources_used_count = sources_count,
    posts_current_period = posts_count,
    stats_last_updated = NOW(),
    updated_at = NOW()
  WHERE id = user_id_param;
END;
$$;

-- Функція для скидання статистики постів
CREATE OR REPLACE FUNCTION reset_user_posts_stats(user_id_param UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles SET
    posts_current_period = 0,
    stats_period_start = NOW(),
    stats_last_updated = NOW(),
    updated_at = NOW()
  WHERE id = user_id_param;
END;
$$;

-- Ініціалізуємо статистику для існуючих користувачів
DO $$
DECLARE
  user_record RECORD;
BEGIN
  FOR user_record IN 
    SELECT DISTINCT user_id FROM (
      SELECT user_id FROM bot_services
      UNION
      SELECT user_id FROM ai_bot_services
    ) AS all_users
  LOOP
    PERFORM update_user_stats(user_record.user_id);
  END LOOP;
END;
$$;

-- ==========================================
-- МІГРАЦІЯ 2: Тригери для автооновлення
-- ==========================================

-- Тригер для bot_services
CREATE OR REPLACE FUNCTION trigger_update_stats_bot_services()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_user_stats(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM update_user_stats(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stats_on_bot_services ON bot_services;
CREATE TRIGGER update_stats_on_bot_services
AFTER INSERT OR DELETE ON bot_services
FOR EACH ROW
EXECUTE FUNCTION trigger_update_stats_bot_services();

-- Тригер для ai_bot_services
CREATE OR REPLACE FUNCTION trigger_update_stats_ai_bot_services()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM update_user_stats(OLD.user_id);
    RETURN OLD;
  ELSE
    PERFORM update_user_stats(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stats_on_ai_bot_services ON ai_bot_services;
CREATE TRIGGER update_stats_on_ai_bot_services
AFTER INSERT OR DELETE ON ai_bot_services
FOR EACH ROW
EXECUTE FUNCTION trigger_update_stats_ai_bot_services();

-- Тригер для source_channels
CREATE OR REPLACE FUNCTION trigger_update_stats_source_channels()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT user_id INTO target_user_id FROM bot_services WHERE id = OLD.bot_service_id;
    IF target_user_id IS NOT NULL THEN
      PERFORM update_user_stats(target_user_id);
    END IF;
    RETURN OLD;
  ELSE
    SELECT user_id INTO target_user_id FROM bot_services WHERE id = NEW.bot_service_id;
    IF target_user_id IS NOT NULL THEN
      PERFORM update_user_stats(target_user_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stats_on_source_channels ON source_channels;
CREATE TRIGGER update_stats_on_source_channels
AFTER INSERT OR DELETE ON source_channels
FOR EACH ROW
EXECUTE FUNCTION trigger_update_stats_source_channels();

-- Тригер для posts_history
CREATE OR REPLACE FUNCTION trigger_update_stats_posts()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT user_id INTO target_user_id FROM bot_services WHERE id = NEW.bot_service_id;
  IF target_user_id IS NOT NULL THEN
    PERFORM update_user_stats(target_user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stats_on_posts_history ON posts_history;
CREATE TRIGGER update_stats_on_posts_history
AFTER INSERT ON posts_history
FOR EACH ROW
EXECUTE FUNCTION trigger_update_stats_posts();

-- Тригер для ai_generated_posts
CREATE OR REPLACE FUNCTION trigger_update_stats_ai_posts()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
BEGIN
  SELECT user_id INTO target_user_id FROM ai_bot_services WHERE id = NEW.ai_bot_service_id;
  IF target_user_id IS NOT NULL THEN
    PERFORM update_user_stats(target_user_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_stats_on_ai_generated_posts ON ai_generated_posts;
CREATE TRIGGER update_stats_on_ai_generated_posts
AFTER INSERT ON ai_generated_posts
FOR EACH ROW
EXECUTE FUNCTION trigger_update_stats_ai_posts();

-- RPC функція для отримання статистики (доступна користувачам)
CREATE OR REPLACE FUNCTION get_user_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
  current_user_id UUID;
BEGIN
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Оновлюємо статистику
  PERFORM update_user_stats(current_user_id);
  
  -- Повертаємо результат
  SELECT json_build_object(
    'user_id', id,
    'bots_used_count', bots_used_count,
    'channels_used_count', channels_used_count,
    'sources_used_count', sources_used_count,
    'posts_current_period', posts_current_period,
    'stats_period_start', stats_period_start,
    'stats_last_updated', stats_last_updated
  ) INTO result
  FROM profiles
  WHERE id = current_user_id;
  
  RETURN result;
END;
$$;

COMMENT ON FUNCTION get_user_stats IS 'Отримати власну статистику використання';

-- ==========================================
-- ГОТОВО! Міграції застосовано
-- ==========================================
