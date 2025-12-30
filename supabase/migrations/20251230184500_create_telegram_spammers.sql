-- Create telegram_spammers table for TData auth
CREATE TABLE IF NOT EXISTS public.telegram_spammers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  phone_number text,
  tdata_path text NOT NULL, -- Path to stored TData folder
  authkey text, -- Optional auth key
  is_active boolean DEFAULT true,
  is_authorized boolean DEFAULT false,
  last_activity_at timestamptz,
  last_error text,
  error_count integer DEFAULT 0,
  messages_sent integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS Policies
ALTER TABLE public.telegram_spammers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own spammers" ON public.telegram_spammers
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own spammers" ON public.telegram_spammers
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own spammers" ON public.telegram_spammers
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own spammers" ON public.telegram_spammers
  FOR DELETE
  USING (auth.uid() = user_id);

-- Admin policies
CREATE POLICY "Admins can view all spammers" ON public.telegram_spammers
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can insert spammers" ON public.telegram_spammers
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update spammers" ON public.telegram_spammers
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete spammers" ON public.telegram_spammers
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Indexes
CREATE INDEX idx_telegram_spammers_user_id ON public.telegram_spammers(user_id);
CREATE INDEX idx_telegram_spammers_is_active ON public.telegram_spammers(is_active);
CREATE INDEX idx_telegram_spammers_is_authorized ON public.telegram_spammers(is_authorized);

-- Trigger for updated_at
CREATE TRIGGER update_telegram_spammers_updated_at
  BEFORE UPDATE ON public.telegram_spammers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
