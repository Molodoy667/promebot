-- Виправлення тригерів видалення - використовуємо правильні поля

-- Виправляємо тригер для ai_bot_services
CREATE OR REPLACE FUNCTION cleanup_ai_bot_service_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Видаляємо історію статистики (використовуємо service_id, не ai_bot_service_id)
  DELETE FROM public.channel_stats_history
  WHERE service_id = OLD.id AND service_type = 'ai';

  -- posts_current_period залишається незмінним
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Виправляємо тригер для bot_services
CREATE OR REPLACE FUNCTION cleanup_bot_service_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Видаляємо історію статистики (використовуємо service_id, не bot_service_id)
  DELETE FROM public.channel_stats_history
  WHERE service_id = OLD.id AND service_type = 'plagiarist';

  -- posts_current_period залишається незмінним
  
  -- Видаляємо source_channels для плагіат-ботів
  DELETE FROM public.source_channels
  WHERE bot_service_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
