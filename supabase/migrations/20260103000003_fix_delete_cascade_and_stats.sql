-- Fix CASCADE for ai_generated_posts and posts_history
-- При видаленні сервісу видаляються всі пости та скидається лічильник

-- 1. Додаємо CASCADE для ai_generated_posts
ALTER TABLE public.ai_generated_posts
DROP CONSTRAINT IF EXISTS ai_generated_posts_ai_bot_service_id_fkey CASCADE;

ALTER TABLE public.ai_generated_posts
ADD CONSTRAINT ai_generated_posts_ai_bot_service_id_fkey
FOREIGN KEY (ai_bot_service_id)
REFERENCES public.ai_bot_services(id)
ON DELETE CASCADE;

-- 2. Перевіряємо CASCADE для posts_history
ALTER TABLE public.posts_history
DROP CONSTRAINT IF EXISTS posts_history_bot_service_id_fkey CASCADE;

ALTER TABLE public.posts_history
ADD CONSTRAINT posts_history_bot_service_id_fkey
FOREIGN KEY (bot_service_id)
REFERENCES public.bot_services(id)
ON DELETE CASCADE;

-- 3. Додаємо CASCADE для ai_content_sources
ALTER TABLE public.ai_content_sources
DROP CONSTRAINT IF EXISTS ai_content_sources_ai_bot_service_id_fkey CASCADE;

ALTER TABLE public.ai_content_sources
ADD CONSTRAINT ai_content_sources_ai_bot_service_id_fkey
FOREIGN KEY (ai_bot_service_id)
REFERENCES public.ai_bot_services(id)
ON DELETE CASCADE;

-- 4. Додаємо CASCADE для ai_publishing_settings
ALTER TABLE public.ai_publishing_settings
DROP CONSTRAINT IF EXISTS ai_publishing_settings_ai_bot_service_id_fkey CASCADE;

ALTER TABLE public.ai_publishing_settings
ADD CONSTRAINT ai_publishing_settings_ai_bot_service_id_fkey
FOREIGN KEY (ai_bot_service_id)
REFERENCES public.ai_bot_services(id)
ON DELETE CASCADE;

-- 5. Додаємо CASCADE для channel_stats_history (щоб очищались при видаленні сервісу)
-- Спочатку видаляємо старі записи без foreign key, якщо є
DELETE FROM public.channel_stats_history
WHERE service_type = 'ai' AND service_id NOT IN (SELECT id FROM public.ai_bot_services)
   OR service_type = 'plagiarist' AND service_id NOT IN (SELECT id FROM public.bot_services);

-- Не додаємо foreign key constraint для channel_stats_history, бо service_id може бути різних типів
-- Замість цього створюємо тригер на видалення

-- 6. Функція для очищення статистики при видаленні AI bot service
CREATE OR REPLACE FUNCTION cleanup_ai_service_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Видаляємо статистику каналу
  DELETE FROM public.channel_stats_history
  WHERE service_id = OLD.id AND service_type = 'ai';
  
  -- НЕ скидаємо лічильник постів - користувач вже опублікував ці пости
  -- posts_current_period залишається незмінним
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригер для AI bot services
DROP TRIGGER IF EXISTS trigger_cleanup_ai_service_stats ON public.ai_bot_services;
CREATE TRIGGER trigger_cleanup_ai_service_stats
  BEFORE DELETE ON public.ai_bot_services
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_ai_service_stats();

-- 7. Функція для очищення статистики при видаленні bot service (plagiarist)
CREATE OR REPLACE FUNCTION cleanup_bot_service_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Видаляємо статистику каналу
  DELETE FROM public.channel_stats_history
  WHERE service_id = OLD.id AND service_type = 'plagiarist';
  
  -- НЕ скидаємо лічильник постів - користувач вже опублікував ці пости
  -- posts_current_period залишається незмінним
  
  -- Видаляємо source channels
  DELETE FROM public.source_channels
  WHERE bot_service_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригер для bot services
DROP TRIGGER IF EXISTS trigger_cleanup_bot_service_stats ON public.bot_services;
CREATE TRIGGER trigger_cleanup_bot_service_stats
  BEFORE DELETE ON public.bot_services
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_bot_service_stats();

COMMENT ON FUNCTION cleanup_ai_service_stats IS 'Очищає статистику каналу при видаленні AI bot service (лічильник постів НЕ скидається)';
COMMENT ON FUNCTION cleanup_bot_service_stats IS 'Очищає статистику каналу при видаленні bot service (лічильник постів НЕ скидається)';
