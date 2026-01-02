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
  
  -- Рахуємо ТІЛЬКИ ОПУБЛІКОВАНІ пости за період
  SELECT 
    COALESCE((
      SELECT COUNT(*) 
      FROM posts_history ph
      INNER JOIN bot_services bs ON ph.bot_service_id = bs.id
      WHERE bs.user_id = user_id_param 
        AND ph.created_at >= period_start
        AND ph.status = 'published'
    ), 0) +
    COALESCE((
      SELECT COUNT(*) 
      FROM ai_generated_posts agp
      INNER JOIN ai_bot_services abs ON agp.ai_bot_service_id = abs.id
      WHERE abs.user_id = user_id_param 
        AND agp.created_at >= period_start
        AND agp.status = 'published'
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
