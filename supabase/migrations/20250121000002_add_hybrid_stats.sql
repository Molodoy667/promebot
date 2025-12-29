-- Add hybrid stats support to services
ALTER TABLE public.bot_services 
  ADD COLUMN IF NOT EXISTS spy_id uuid REFERENCES public.telegram_spies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stats_method text DEFAULT 'scraping' CHECK (stats_method IN ('scraping', 'mtproto', 'hybrid')),
  ADD COLUMN IF NOT EXISTS last_scraping_sync timestamptz,
  ADD COLUMN IF NOT EXISTS last_mtproto_sync timestamptz;

ALTER TABLE public.ai_bot_services 
  ADD COLUMN IF NOT EXISTS spy_id uuid REFERENCES public.telegram_spies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stats_method text DEFAULT 'scraping' CHECK (stats_method IN ('scraping', 'mtproto', 'hybrid')),
  ADD COLUMN IF NOT EXISTS last_scraping_sync timestamptz,
  ADD COLUMN IF NOT EXISTS last_mtproto_sync timestamptz;

-- Add separate stats storage to posts
ALTER TABLE public.posts_history
  ADD COLUMN IF NOT EXISTS scraping_stats jsonb,
  ADD COLUMN IF NOT EXISTS mtproto_stats jsonb;

ALTER TABLE public.ai_generated_posts
  ADD COLUMN IF NOT EXISTS scraping_stats jsonb,
  ADD COLUMN IF NOT EXISTS mtproto_stats jsonb;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_bot_services_spy_id ON public.bot_services(spy_id);
CREATE INDEX IF NOT EXISTS idx_ai_bot_services_spy_id ON public.ai_bot_services(spy_id);
CREATE INDEX IF NOT EXISTS idx_bot_services_stats_method ON public.bot_services(stats_method);
CREATE INDEX IF NOT EXISTS idx_ai_bot_services_stats_method ON public.ai_bot_services(stats_method);

-- Comments
COMMENT ON COLUMN public.bot_services.spy_id IS 'Telegram userbot for MTProto stats collection';
COMMENT ON COLUMN public.bot_services.stats_method IS 'Method: scraping (fast), mtproto (accurate), hybrid (both)';
COMMENT ON COLUMN public.posts_history.scraping_stats IS 'Stats from web scraping: {views, reactions, timestamp}';
COMMENT ON COLUMN public.posts_history.mtproto_stats IS 'Stats from MTProto API: {views, forwards, reactions, timestamp}';
