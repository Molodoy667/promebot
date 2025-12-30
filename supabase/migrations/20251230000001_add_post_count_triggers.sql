-- Тригери для автоматичного оновлення лічильника постів

-- Функція для оновлення лічильника постів при публікації (плагіатор)
CREATE OR REPLACE FUNCTION update_bot_posts_count_on_publish()
RETURNS TRIGGER AS $$
DECLARE
  v_bot_id UUID;
BEGIN
  -- Отримати bot_id через bot_service_id
  SELECT bs.bot_id INTO v_bot_id
  FROM public.bot_services bs
  WHERE bs.id = NEW.bot_service_id;

  IF v_bot_id IS NOT NULL THEN
    -- Ініціалізувати статистику якщо не існує
    INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
    VALUES (v_bot_id, 0, 0, 0)
    ON CONFLICT (bot_id) DO NOTHING;

    -- Інкрементувати лічильник постів
    UPDATE public.bot_global_stats
    SET total_posts = total_posts + 1
    WHERE bot_id = v_bot_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригер для posts_history (плагіатор)
DROP TRIGGER IF EXISTS trigger_increment_posts_on_publish ON public.posts_history;
CREATE TRIGGER trigger_increment_posts_on_publish
  AFTER INSERT ON public.posts_history
  FOR EACH ROW
  WHEN (NEW.status = 'published')
  EXECUTE FUNCTION update_bot_posts_count_on_publish();

-- Функція для оновлення лічильника постів AI-бота
CREATE OR REPLACE FUNCTION update_bot_posts_count_on_ai_publish()
RETURNS TRIGGER AS $$
DECLARE
  v_bot_id UUID;
BEGIN
  -- Отримати bot_id через ai_bot_service_id
  SELECT ai.bot_id INTO v_bot_id
  FROM public.ai_bot_services ai
  WHERE ai.id = NEW.ai_bot_service_id;

  IF v_bot_id IS NOT NULL THEN
    -- Ініціалізувати статистику якщо не існує
    INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
    VALUES (v_bot_id, 0, 0, 0)
    ON CONFLICT (bot_id) DO NOTHING;

    -- Інкрементувати лічильник постів
    UPDATE public.bot_global_stats
    SET total_posts = total_posts + 1
    WHERE bot_id = v_bot_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригер для ai_generated_posts (AI-бот)
-- Спрацьовує при зміні статусу на 'published'
DROP TRIGGER IF EXISTS trigger_increment_ai_posts_on_publish ON public.ai_generated_posts;
CREATE TRIGGER trigger_increment_ai_posts_on_publish
  AFTER UPDATE ON public.ai_generated_posts
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM 'published' AND NEW.status = 'published')
  EXECUTE FUNCTION update_bot_posts_count_on_ai_publish();

-- Функція для декременту при видаленні опублікованого посту (плагіатор)
CREATE OR REPLACE FUNCTION decrement_bot_posts_count_on_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_bot_id UUID;
BEGIN
  -- Тільки якщо пост був опублікований
  IF OLD.status = 'published' THEN
    SELECT bs.bot_id INTO v_bot_id
    FROM public.bot_services bs
    WHERE bs.id = OLD.bot_service_id;

    IF v_bot_id IS NOT NULL THEN
      UPDATE public.bot_global_stats
      SET total_posts = GREATEST(0, total_posts - 1)
      WHERE bot_id = v_bot_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригер для видалення постів плагіатора
DROP TRIGGER IF EXISTS trigger_decrement_posts_on_delete ON public.posts_history;
CREATE TRIGGER trigger_decrement_posts_on_delete
  AFTER DELETE ON public.posts_history
  FOR EACH ROW
  EXECUTE FUNCTION decrement_bot_posts_count_on_delete();

-- Функція для декременту при видаленні AI-посту
CREATE OR REPLACE FUNCTION decrement_bot_posts_count_on_ai_delete()
RETURNS TRIGGER AS $$
DECLARE
  v_bot_id UUID;
BEGIN
  -- Тільки якщо пост був опублікований
  IF OLD.status = 'published' THEN
    SELECT ai.bot_id INTO v_bot_id
    FROM public.ai_bot_services ai
    WHERE ai.id = OLD.ai_bot_service_id;

    IF v_bot_id IS NOT NULL THEN
      UPDATE public.bot_global_stats
      SET total_posts = GREATEST(0, total_posts - 1)
      WHERE bot_id = v_bot_id;
    END IF;
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригер для видалення AI-постів
DROP TRIGGER IF EXISTS trigger_decrement_ai_posts_on_delete ON public.ai_generated_posts;
CREATE TRIGGER trigger_decrement_ai_posts_on_delete
  AFTER DELETE ON public.ai_generated_posts
  FOR EACH ROW
  EXECUTE FUNCTION decrement_bot_posts_count_on_ai_delete();
