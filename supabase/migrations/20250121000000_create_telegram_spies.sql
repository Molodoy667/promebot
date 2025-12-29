-- Create telegram_spies table for channel monitoring
CREATE TABLE IF NOT EXISTS public.telegram_spies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  user_agent_hash text NOT NULL UNIQUE,
  name text,
  is_active boolean DEFAULT true,
  channels_monitored integer DEFAULT 0,
  last_activity_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create spy_channel_data table for collected info
CREATE TABLE IF NOT EXISTS public.spy_channel_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spy_id uuid REFERENCES public.telegram_spies(id) ON DELETE CASCADE,
  channel_username text,
  channel_id text,
  channel_title text,
  is_private boolean DEFAULT false,
  members_count integer,
  posts_count integer,
  last_post_date timestamptz,
  channel_data jsonb,
  collected_at timestamptz DEFAULT now()
);

-- RLS policies
ALTER TABLE public.telegram_spies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spy_channel_data ENABLE ROW LEVEL SECURITY;

-- Admin can see all spies
CREATE POLICY "Admins can view all spies" ON public.telegram_spies
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert spies" ON public.telegram_spies
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update spies" ON public.telegram_spies
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete spies" ON public.telegram_spies
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Spy data policies
CREATE POLICY "Admins can view spy data" ON public.spy_channel_data
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Service can insert spy data" ON public.spy_channel_data
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_telegram_spies_user_id ON public.telegram_spies(user_id);
CREATE INDEX IF NOT EXISTS idx_telegram_spies_is_active ON public.telegram_spies(is_active);
CREATE INDEX IF NOT EXISTS idx_spy_channel_data_spy_id ON public.spy_channel_data(spy_id);
CREATE INDEX IF NOT EXISTS idx_spy_channel_data_channel_username ON public.spy_channel_data(channel_username);
