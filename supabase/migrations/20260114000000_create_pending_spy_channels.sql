-- Create table for tracking temporarily joined channels
CREATE TABLE IF NOT EXISTS public.pending_spy_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spy_id uuid REFERENCES public.telegram_spies(id) ON DELETE CASCADE NOT NULL,
  channel_id text NOT NULL,
  channel_identifier text NOT NULL,
  joined_at timestamptz DEFAULT now() NOT NULL,
  should_leave_at timestamptz DEFAULT (now() + interval '5 minutes') NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'left')),
  created_at timestamptz DEFAULT now()
);

-- Index for auto-cleanup queries
CREATE INDEX IF NOT EXISTS idx_pending_spy_channels_should_leave 
  ON public.pending_spy_channels(should_leave_at) 
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_pending_spy_channels_spy_id 
  ON public.pending_spy_channels(spy_id);

-- RLS policies
ALTER TABLE public.pending_spy_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their pending channels" 
  ON public.pending_spy_channels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their pending channels" 
  ON public.pending_spy_channels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their pending channels" 
  ON public.pending_spy_channels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service can manage all pending channels" 
  ON public.pending_spy_channels FOR ALL
  USING (true);

COMMENT ON TABLE public.pending_spy_channels IS 'Tracks channels that spy temporarily joined for verification';
COMMENT ON COLUMN public.pending_spy_channels.should_leave_at IS 'When to auto-leave if not confirmed by user';
COMMENT ON COLUMN public.pending_spy_channels.status IS 'pending: waiting for confirmation, confirmed: user added to bot, left: auto-left';
