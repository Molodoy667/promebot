-- Create channel_stats_history table for tracking stats over time
CREATE TABLE IF NOT EXISTS public.channel_stats_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  service_type text NOT NULL, -- 'plagiarist', 'ai', 'spy', 'spammer'
  channel_name text,
  subscribers_count integer DEFAULT 0,
  total_views integer DEFAULT 0,
  total_reactions integer DEFAULT 0,
  recorded_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX idx_channel_stats_history_service ON public.channel_stats_history(service_id, service_type);
CREATE INDEX idx_channel_stats_history_recorded_at ON public.channel_stats_history(recorded_at DESC);
CREATE INDEX idx_channel_stats_history_lookup ON public.channel_stats_history(service_id, service_type, recorded_at DESC);

-- RLS Policies
ALTER TABLE public.channel_stats_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own stats history
CREATE POLICY "Users can view own stats history" ON public.channel_stats_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.telegram_bots
      WHERE telegram_bots.id = channel_stats_history.service_id
        AND telegram_bots.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.telegram_spies
      WHERE telegram_spies.id = channel_stats_history.service_id
        AND telegram_spies.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.telegram_spammers
      WHERE telegram_spammers.id = channel_stats_history.service_id
        AND telegram_spammers.user_id = auth.uid()
    )
  );

-- Users can insert their own stats history
CREATE POLICY "Users can insert own stats history" ON public.channel_stats_history
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.telegram_bots
      WHERE telegram_bots.id = channel_stats_history.service_id
        AND telegram_bots.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.telegram_spies
      WHERE telegram_spies.id = channel_stats_history.service_id
        AND telegram_spies.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.telegram_spammers
      WHERE telegram_spammers.id = channel_stats_history.service_id
        AND telegram_spammers.user_id = auth.uid()
    )
  );

-- Admin can see all stats history
CREATE POLICY "Admins can view all stats history" ON public.channel_stats_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Comment
COMMENT ON TABLE public.channel_stats_history IS 'Historical stats snapshots for channels';
