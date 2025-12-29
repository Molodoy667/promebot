-- Тригери для автоматичного оновлення статистики

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
