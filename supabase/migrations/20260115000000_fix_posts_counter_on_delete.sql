-- Виправлення: posts_current_period НЕ повинен змінюватись при видаленні каналу
-- Проблема: тригери викликають update_user_stats(), яка перераховує пости і зменшує лічильник

-- ============================================
-- ЧАСТИНА 1: Виправляємо тригери bot_services
-- ============================================

CREATE OR REPLACE FUNCTION trigger_update_stats_bot_services()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- При видаленні - оновлюємо тільки bots_used_count, channels_used_count, sources_used_count
    -- posts_current_period НЕ чіпаємо
    UPDATE profiles SET
      bots_used_count = (
        SELECT COUNT(DISTINCT bot_id)
        FROM (
          SELECT bot_id FROM ai_bot_services WHERE user_id = OLD.user_id
          UNION
          SELECT bot_id FROM bot_services WHERE user_id = OLD.user_id AND id != OLD.id LIMIT 1
        ) AS unique_bots
      ),
      channels_used_count = (
        SELECT 
          COALESCE((SELECT COUNT(*) FROM bot_services WHERE user_id = OLD.user_id AND id != OLD.id), 0) +
          COALESCE((SELECT COUNT(*) FROM ai_bot_services WHERE user_id = OLD.user_id), 0)
      ),
      sources_used_count = (
        SELECT COUNT(*) 
        FROM source_channels sc
        INNER JOIN bot_services bs ON sc.bot_service_id = bs.id
        WHERE bs.user_id = OLD.user_id AND bs.id != OLD.id
      ),
      stats_last_updated = NOW(),
      updated_at = NOW()
    WHERE id = OLD.user_id;
    RETURN OLD;
  ELSE
    -- При додаванні - повний перерахунок
    PERFORM update_user_stats(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ЧАСТИНА 2: Виправляємо тригери ai_bot_services
-- ============================================

CREATE OR REPLACE FUNCTION trigger_update_stats_ai_bot_services()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    -- При видаленні - оновлюємо тільки bots_used_count, channels_used_count
    -- posts_current_period НЕ чіпаємо
    UPDATE profiles SET
      bots_used_count = (
        SELECT COUNT(DISTINCT bot_id)
        FROM (
          SELECT bot_id FROM ai_bot_services WHERE user_id = OLD.user_id AND id != OLD.id
          UNION
          SELECT bot_id FROM bot_services WHERE user_id = OLD.user_id LIMIT 1
        ) AS unique_bots
      ),
      channels_used_count = (
        SELECT 
          COALESCE((SELECT COUNT(*) FROM bot_services WHERE user_id = OLD.user_id), 0) +
          COALESCE((SELECT COUNT(*) FROM ai_bot_services WHERE user_id = OLD.user_id AND id != OLD.id), 0)
      ),
      stats_last_updated = NOW(),
      updated_at = NOW()
    WHERE id = OLD.user_id;
    RETURN OLD;
  ELSE
    -- При додаванні - повний перерахунок
    PERFORM update_user_stats(NEW.user_id);
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ЧАСТИНА 3: Виправляємо тригери source_channels
-- ============================================

CREATE OR REPLACE FUNCTION trigger_update_stats_source_channels()
RETURNS TRIGGER AS $$
DECLARE
  target_user_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT user_id INTO target_user_id FROM bot_services WHERE id = OLD.bot_service_id;
    IF target_user_id IS NOT NULL THEN
      -- При видаленні - оновлюємо тільки sources_used_count
      UPDATE profiles SET
        sources_used_count = (
          SELECT COUNT(*) 
          FROM source_channels sc
          INNER JOIN bot_services bs ON sc.bot_service_id = bs.id
          WHERE bs.user_id = target_user_id AND sc.id != OLD.id
        ),
        stats_last_updated = NOW(),
        updated_at = NOW()
      WHERE id = target_user_id;
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

-- ============================================
-- ЧАСТИНА 4: Тригери для постів - ТІЛЬКИ INSERT
-- ============================================

-- Тригер для posts_history - залишаємо тільки INSERT
DROP TRIGGER IF EXISTS update_stats_on_posts_history ON posts_history;
CREATE TRIGGER update_stats_on_posts_history
AFTER INSERT ON posts_history
FOR EACH ROW
EXECUTE FUNCTION trigger_update_stats_posts();

-- Тригер для ai_generated_posts - залишаємо тільки INSERT
DROP TRIGGER IF EXISTS update_stats_on_ai_generated_posts ON ai_generated_posts;
CREATE TRIGGER update_stats_on_ai_generated_posts
AFTER INSERT ON ai_generated_posts
FOR EACH ROW
EXECUTE FUNCTION trigger_update_stats_ai_posts();

-- ============================================
-- КОМЕНТАРІ
-- ============================================

COMMENT ON COLUMN public.profiles.posts_current_period IS 'Пости за поточний місяць - НЕ зменшується при видаленні каналів або постів';
