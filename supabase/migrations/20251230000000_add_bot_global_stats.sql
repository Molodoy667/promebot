-- Таблиця для глобальної статистики бота (всі користувачі)
CREATE TABLE IF NOT EXISTS public.bot_global_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  
  -- Статистика
  total_users INTEGER DEFAULT 0,           -- Загальна кількість користувачів
  total_channels INTEGER DEFAULT 0,        -- Загальна кількість каналів
  total_posts INTEGER DEFAULT 0,           -- Загальна кількість опублікованих постів
  
  -- Метадані
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Унікальний індекс: один запис статистики на бота
  UNIQUE(bot_id)
);

-- Індекси
CREATE INDEX IF NOT EXISTS idx_bot_global_stats_bot_id ON public.bot_global_stats(bot_id);

-- RLS policies
ALTER TABLE public.bot_global_stats ENABLE ROW LEVEL SECURITY;

-- Всі можуть читати статистику
CREATE POLICY "Allow read bot_global_stats for all authenticated users"
  ON public.bot_global_stats
  FOR SELECT
  TO authenticated
  USING (true);

-- Тільки сервіс може оновлювати
CREATE POLICY "Allow update bot_global_stats for service role"
  ON public.bot_global_stats
  FOR UPDATE
  TO service_role
  USING (true);

CREATE POLICY "Allow insert bot_global_stats for service role"
  ON public.bot_global_stats
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Функція для оновлення updated_at
CREATE OR REPLACE FUNCTION update_bot_global_stats_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Тригер для updated_at
DROP TRIGGER IF EXISTS trigger_update_bot_global_stats_updated_at ON public.bot_global_stats;
CREATE TRIGGER trigger_update_bot_global_stats_updated_at
  BEFORE UPDATE ON public.bot_global_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_global_stats_updated_at();

-- Функція для ініціалізації статистики бота
CREATE OR REPLACE FUNCTION initialize_bot_global_stats(p_bot_id UUID)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
  VALUES (p_bot_id, 0, 0, 0)
  ON CONFLICT (bot_id) DO NOTHING;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функція для оновлення статистики при додаванні/видаленні каналу
CREATE OR REPLACE FUNCTION update_bot_stats_on_channel_change()
RETURNS TRIGGER AS $$
DECLARE
  v_bot_id UUID;
  v_user_id UUID;
  v_user_channels_count INTEGER;
BEGIN
  -- Визначити bot_id в залежності від типу сервісу
  IF TG_TABLE_NAME = 'bot_services' THEN
    v_bot_id := COALESCE(NEW.bot_id, OLD.bot_id);
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'ai_bot_services' THEN
    v_bot_id := COALESCE(NEW.bot_id, OLD.bot_id);
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Ініціалізувати статистику якщо не існує
  INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
  VALUES (v_bot_id, 0, 0, 0)
  ON CONFLICT (bot_id) DO NOTHING;

  IF TG_OP = 'INSERT' THEN
    -- Перевірити чи це перший канал цього користувача для цього бота
    IF TG_TABLE_NAME = 'bot_services' THEN
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.bot_services
      WHERE user_id = v_user_id AND bot_id = v_bot_id;
    ELSE
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.ai_bot_services
      WHERE user_id = v_user_id AND bot_id = v_bot_id;
    END IF;

    -- Оновити статистику
    UPDATE public.bot_global_stats
    SET 
      total_channels = total_channels + 1,
      total_users = CASE 
        WHEN v_user_channels_count = 1 THEN total_users + 1  -- Перший канал користувача
        ELSE total_users
      END
    WHERE bot_id = v_bot_id;

  ELSIF TG_OP = 'DELETE' THEN
    -- Перевірити чи залишились інші канали цього користувача
    IF TG_TABLE_NAME = 'bot_services' THEN
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.bot_services
      WHERE user_id = v_user_id AND bot_id = v_bot_id AND id != OLD.id;
    ELSE
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.ai_bot_services
      WHERE user_id = v_user_id AND bot_id = v_bot_id AND id != OLD.id;
    END IF;

    -- Оновити статистику
    UPDATE public.bot_global_stats
    SET 
      total_channels = GREATEST(0, total_channels - 1),
      total_users = CASE 
        WHEN v_user_channels_count = 0 THEN GREATEST(0, total_users - 1)  -- Останній канал користувача
        ELSE total_users
      END
    WHERE bot_id = v_bot_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригери для bot_services (плагіатор)
DROP TRIGGER IF EXISTS trigger_bot_stats_on_bot_service_insert ON public.bot_services;
CREATE TRIGGER trigger_bot_stats_on_bot_service_insert
  AFTER INSERT ON public.bot_services
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_stats_on_channel_change();

DROP TRIGGER IF EXISTS trigger_bot_stats_on_bot_service_delete ON public.bot_services;
CREATE TRIGGER trigger_bot_stats_on_bot_service_delete
  AFTER DELETE ON public.bot_services
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_stats_on_channel_change();

-- Тригери для ai_bot_services (AI-бот)
DROP TRIGGER IF EXISTS trigger_bot_stats_on_ai_bot_service_insert ON public.ai_bot_services;
CREATE TRIGGER trigger_bot_stats_on_ai_bot_service_insert
  AFTER INSERT ON public.ai_bot_services
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_stats_on_channel_change();

DROP TRIGGER IF EXISTS trigger_bot_stats_on_ai_bot_service_delete ON public.ai_bot_services;
CREATE TRIGGER trigger_bot_stats_on_ai_bot_service_delete
  AFTER DELETE ON public.ai_bot_services
  FOR EACH ROW
  EXECUTE FUNCTION update_bot_stats_on_channel_change();

-- Функція для оновлення лічильника постів
CREATE OR REPLACE FUNCTION increment_bot_posts_count(p_bot_id UUID, p_increment INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
  -- Ініціалізувати якщо не існує
  INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
  VALUES (p_bot_id, 0, 0, 0)
  ON CONFLICT (bot_id) DO NOTHING;

  -- Інкрементувати лічильник
  UPDATE public.bot_global_stats
  SET total_posts = total_posts + p_increment
  WHERE bot_id = p_bot_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функція для ініціалізації статистики для існуючих ботів
CREATE OR REPLACE FUNCTION recalculate_bot_global_stats()
RETURNS TABLE(bot_id UUID, users INTEGER, channels INTEGER, posts INTEGER) AS $$
BEGIN
  RETURN QUERY
  WITH bot_data AS (
    -- Статистика з bot_services (плагіатор)
    SELECT 
      bs.bot_id,
      COUNT(DISTINCT bs.user_id) as users,
      COUNT(bs.id) as channels,
      COALESCE(SUM(bs.posts_count), 0)::INTEGER as posts
    FROM public.bot_services bs
    GROUP BY bs.bot_id
    
    UNION ALL
    
    -- Статистика з ai_bot_services (AI-бот)
    SELECT 
      ai.bot_id,
      COUNT(DISTINCT ai.user_id) as users,
      COUNT(ai.id) as channels,
      (
        SELECT COUNT(*)::INTEGER 
        FROM public.ai_generated_posts agp 
        WHERE agp.ai_bot_service_id = ai.id 
        AND agp.status = 'published'
      ) as posts
    FROM public.ai_bot_services ai
    GROUP BY ai.bot_id
  ),
  aggregated AS (
    SELECT 
      bd.bot_id,
      SUM(bd.users)::INTEGER as total_users,
      SUM(bd.channels)::INTEGER as total_channels,
      SUM(bd.posts)::INTEGER as total_posts
    FROM bot_data bd
    GROUP BY bd.bot_id
  )
  SELECT 
    a.bot_id,
    a.total_users,
    a.total_channels,
    a.total_posts
  FROM aggregated a;
END;
$$ LANGUAGE plpgsql;

-- Ініціалізувати статистику для існуючих ботів
DO $$
DECLARE
  bot_record RECORD;
BEGIN
  FOR bot_record IN 
    SELECT bot_id, users, channels, posts 
    FROM recalculate_bot_global_stats()
  LOOP
    INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
    VALUES (bot_record.bot_id, bot_record.users, bot_record.channels, bot_record.posts)
    ON CONFLICT (bot_id) 
    DO UPDATE SET
      total_users = EXCLUDED.total_users,
      total_channels = EXCLUDED.total_channels,
      total_posts = EXCLUDED.total_posts;
  END LOOP;
END $$;
