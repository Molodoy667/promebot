-- Виправлення логіки лічильників постів
-- 1. bot_global_stats.total_posts НЕ повинен зменшуватись при видаленні постів
-- 2. posts_current_period НЕ повинен обнулятись при видаленні каналу

-- ============================================
-- ЧАСТИНА 1: Видаляємо тригери декременту для bot_global_stats
-- ============================================

-- Видаляємо тригер декременту для posts_history
DROP TRIGGER IF EXISTS trigger_decrement_posts_on_delete ON public.posts_history;
DROP FUNCTION IF EXISTS decrement_bot_posts_count_on_delete();

-- Видаляємо тригер декременту для ai_generated_posts
DROP TRIGGER IF EXISTS trigger_decrement_ai_posts_on_delete ON public.ai_generated_posts;
DROP FUNCTION IF EXISTS decrement_bot_posts_count_on_ai_delete();

-- Коментар: bot_global_stats.total_posts тепер є історичним лічильником
-- Він збільшується при публікації, але НЕ зменшується при видаленні
COMMENT ON COLUMN public.bot_global_stats.total_posts IS 'Історичний лічильник - всього опубліковано постів за весь час (не зменшується при видаленні)';

-- ============================================
-- ЧАСТИНА 2: Виправляємо тригери видалення каналів
-- ============================================

-- Виправляємо тригер для ai_bot_services - НЕ обнуляти posts_current_period
CREATE OR REPLACE FUNCTION cleanup_ai_bot_service_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Видаляємо історію статистики
  DELETE FROM public.channel_stats_history
  WHERE ai_bot_service_id = OLD.id;

  -- posts_current_period залишається незмінним (не обнуляємо)
  -- Це місячний ліміт, який не повинен змінюватись при видаленні каналу

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_cleanup_ai_service_stats ON public.ai_bot_services;
CREATE TRIGGER trigger_cleanup_ai_service_stats
  BEFORE DELETE ON public.ai_bot_services
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_ai_bot_service_stats();

-- Виправляємо тригер для bot_services - НЕ обнуляти posts_current_period
CREATE OR REPLACE FUNCTION cleanup_bot_service_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Видаляємо історію статистики
  DELETE FROM public.channel_stats_history
  WHERE bot_service_id = OLD.id;

  -- posts_current_period залишається незмінним (не обнуляємо)
  
  -- Видаляємо source_channels для плагіат-ботів
  DELETE FROM public.source_channels
  WHERE bot_service_id = OLD.id;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_cleanup_service_stats ON public.bot_services;
CREATE TRIGGER trigger_cleanup_service_stats
  BEFORE DELETE ON public.bot_services
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_bot_service_stats();

-- ============================================
-- ЧАСТИНА 3: Додаємо коментарі для ясності
-- ============================================

COMMENT ON COLUMN public.profiles.posts_current_period IS 'Ліміт постів за поточний місяць - НЕ скидається при видаленні каналів, тільки при зміні тарифу або новому місяці';
