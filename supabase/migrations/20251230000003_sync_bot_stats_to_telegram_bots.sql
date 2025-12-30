-- Синхронізація bot_global_stats з telegram_bots

-- Функція для оновлення статистики в telegram_bots
CREATE OR REPLACE FUNCTION sync_global_stats_to_telegram_bots()
RETURNS TRIGGER AS $$
BEGIN
  -- Оновити поля в telegram_bots з bot_global_stats
  UPDATE public.telegram_bots
  SET 
    users_count = NEW.total_users,
    channels_count = NEW.total_channels,
    posts_count = NEW.total_posts,
    updated_at = NOW()
  WHERE id = NEW.bot_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригер на INSERT та UPDATE в bot_global_stats
DROP TRIGGER IF EXISTS trigger_sync_stats_to_telegram_bots ON public.bot_global_stats;
CREATE TRIGGER trigger_sync_stats_to_telegram_bots
  AFTER INSERT OR UPDATE ON public.bot_global_stats
  FOR EACH ROW
  EXECUTE FUNCTION sync_global_stats_to_telegram_bots();

-- Перевірити чи існують поля в telegram_bots
DO $$
BEGIN
  -- Додати users_count якщо не існує
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'telegram_bots' AND column_name = 'users_count'
  ) THEN
    ALTER TABLE public.telegram_bots ADD COLUMN users_count INTEGER DEFAULT 0;
  END IF;

  -- Додати channels_count якщо не існує
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'telegram_bots' AND column_name = 'channels_count'
  ) THEN
    ALTER TABLE public.telegram_bots ADD COLUMN channels_count INTEGER DEFAULT 0;
  END IF;

  -- Додати posts_count якщо не існує
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'telegram_bots' AND column_name = 'posts_count'
  ) THEN
    ALTER TABLE public.telegram_bots ADD COLUMN posts_count INTEGER DEFAULT 0;
  END IF;
END $$;

-- Синхронізувати поточні дані
UPDATE public.telegram_bots tb
SET 
  users_count = bgs.total_users,
  channels_count = bgs.total_channels,
  posts_count = bgs.total_posts
FROM public.bot_global_stats bgs
WHERE tb.id = bgs.bot_id;

COMMENT ON TRIGGER trigger_sync_stats_to_telegram_bots ON public.bot_global_stats IS 
'Синхронізує статистику з bot_global_stats в telegram_bots';
