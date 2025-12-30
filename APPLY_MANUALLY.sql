-- ========================================
-- ЗАСТОСУЙТЕ ЦЕЙ SQL В SUPABASE DASHBOARD
-- https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/sql/new
-- ========================================

-- КРОК 1: Створення таблиці bot_global_stats
CREATE TABLE IF NOT EXISTS public.bot_global_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
  total_users INTEGER DEFAULT 0,
  total_channels INTEGER DEFAULT 0,
  total_posts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(bot_id)
);

CREATE INDEX IF NOT EXISTS idx_bot_global_stats_bot_id ON public.bot_global_stats(bot_id);

ALTER TABLE public.bot_global_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read bot_global_stats for all authenticated users"
  ON public.bot_global_stats FOR SELECT TO authenticated USING (true);

CREATE POLICY "Allow update bot_global_stats for service role"
  ON public.bot_global_stats FOR UPDATE TO service_role USING (true);

CREATE POLICY "Allow insert bot_global_stats for service role"
  ON public.bot_global_stats FOR INSERT TO service_role WITH CHECK (true);

-- КРОК 2: Функція перерахунку статистики
CREATE OR REPLACE FUNCTION recalculate_bot_global_stats()
RETURNS TABLE(bot_id UUID, users INTEGER, channels INTEGER, posts INTEGER) AS $$
BEGIN
  RETURN QUERY
  WITH bot_data AS (
    SELECT 
      bs.bot_id,
      COUNT(DISTINCT bs.user_id)::INTEGER as users,
      COUNT(bs.id)::INTEGER as channels,
      0::INTEGER as posts
    FROM public.bot_services bs
    GROUP BY bs.bot_id
    
    UNION ALL
    
    SELECT 
      ai.bot_id,
      COUNT(DISTINCT ai.user_id)::INTEGER as users,
      COUNT(ai.id)::INTEGER as channels,
      (
        SELECT COUNT(*)::INTEGER 
        FROM public.ai_generated_posts agp 
        WHERE agp.ai_bot_service_id = ai.id 
        AND agp.status = 'published'
      ) as posts
    FROM public.ai_bot_services ai
    GROUP BY ai.bot_id
  )
  SELECT 
    bd.bot_id,
    SUM(bd.users)::INTEGER as total_users,
    SUM(bd.channels)::INTEGER as total_channels,
    SUM(bd.posts)::INTEGER as total_posts
  FROM bot_data bd
  GROUP BY bd.bot_id;
END;
$$ LANGUAGE plpgsql;

-- КРОК 3: Ініціалізація даних
INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
SELECT bot_id, users, channels, posts 
FROM recalculate_bot_global_stats()
ON CONFLICT (bot_id) 
DO UPDATE SET
  total_users = EXCLUDED.total_users,
  total_channels = EXCLUDED.total_channels,
  total_posts = EXCLUDED.total_posts;

-- КРОК 4: Тригер для оновлення при зміні каналів
CREATE OR REPLACE FUNCTION update_bot_stats_on_channel_change()
RETURNS TRIGGER AS $$
DECLARE
  v_bot_id UUID;
  v_user_id UUID;
  v_user_channels_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'bot_services' THEN
    v_bot_id := COALESCE(NEW.bot_id, OLD.bot_id);
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSIF TG_TABLE_NAME = 'ai_bot_services' THEN
    v_bot_id := COALESCE(NEW.bot_id, OLD.bot_id);
    v_user_id := COALESCE(NEW.user_id, OLD.user_id);
  ELSE
    RETURN COALESCE(NEW, OLD);
  END IF;

  INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
  VALUES (v_bot_id, 0, 0, 0)
  ON CONFLICT (bot_id) DO NOTHING;

  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'bot_services' THEN
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.bot_services WHERE user_id = v_user_id AND bot_id = v_bot_id;
    ELSE
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.ai_bot_services WHERE user_id = v_user_id AND bot_id = v_bot_id;
    END IF;

    UPDATE public.bot_global_stats
    SET 
      total_channels = total_channels + 1,
      total_users = CASE WHEN v_user_channels_count = 1 THEN total_users + 1 ELSE total_users END
    WHERE bot_id = v_bot_id;

  ELSIF TG_OP = 'DELETE' THEN
    IF TG_TABLE_NAME = 'bot_services' THEN
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.bot_services WHERE user_id = v_user_id AND bot_id = v_bot_id AND id != OLD.id;
    ELSE
      SELECT COUNT(*) INTO v_user_channels_count
      FROM public.ai_bot_services WHERE user_id = v_user_id AND bot_id = v_bot_id AND id != OLD.id;
    END IF;

    UPDATE public.bot_global_stats
    SET 
      total_channels = GREATEST(0, total_channels - 1),
      total_users = CASE WHEN v_user_channels_count = 0 THEN GREATEST(0, total_users - 1) ELSE total_users END
    WHERE bot_id = v_bot_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_bot_stats_on_bot_service_insert ON public.bot_services;
CREATE TRIGGER trigger_bot_stats_on_bot_service_insert
  AFTER INSERT ON public.bot_services
  FOR EACH ROW EXECUTE FUNCTION update_bot_stats_on_channel_change();

DROP TRIGGER IF EXISTS trigger_bot_stats_on_bot_service_delete ON public.bot_services;
CREATE TRIGGER trigger_bot_stats_on_bot_service_delete
  AFTER DELETE ON public.bot_services
  FOR EACH ROW EXECUTE FUNCTION update_bot_stats_on_channel_change();

DROP TRIGGER IF EXISTS trigger_bot_stats_on_ai_bot_service_insert ON public.ai_bot_services;
CREATE TRIGGER trigger_bot_stats_on_ai_bot_service_insert
  AFTER INSERT ON public.ai_bot_services
  FOR EACH ROW EXECUTE FUNCTION update_bot_stats_on_channel_change();

DROP TRIGGER IF EXISTS trigger_bot_stats_on_ai_bot_service_delete ON public.ai_bot_services;
CREATE TRIGGER trigger_bot_stats_on_ai_bot_service_delete
  AFTER DELETE ON public.ai_bot_services
  FOR EACH ROW EXECUTE FUNCTION update_bot_stats_on_channel_change();

-- ГОТОВО! Перевірте: SELECT * FROM bot_global_stats;
