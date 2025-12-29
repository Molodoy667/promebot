-- Add spy integration to channels
ALTER TABLE public.channels 
  ADD COLUMN IF NOT EXISTS spy_id uuid REFERENCES public.telegram_spies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS stats_method text DEFAULT 'bot' CHECK (stats_method IN ('bot', 'userbot', 'hybrid')),
  ADD COLUMN IF NOT EXISTS last_bot_sync timestamptz,
  ADD COLUMN IF NOT EXISTS last_userbot_sync timestamptz,
  ADD COLUMN IF NOT EXISTS bot_stats jsonb,
  ADD COLUMN IF NOT EXISTS userbot_stats jsonb;

-- Create index for spy lookup
CREATE INDEX IF NOT EXISTS idx_channels_spy_id ON public.channels(spy_id);
CREATE INDEX IF NOT EXISTS idx_channels_stats_method ON public.channels(stats_method);

-- Comment
COMMENT ON COLUMN public.channels.spy_id IS 'Telegram userbot for collecting detailed stats';
COMMENT ON COLUMN public.channels.stats_method IS 'Method: bot (fast), userbot (detailed), hybrid (both)';
COMMENT ON COLUMN public.channels.bot_stats IS 'Stats collected via Bot API';
COMMENT ON COLUMN public.channels.userbot_stats IS 'Stats collected via MTProto userbot';
