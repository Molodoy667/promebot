-- Create table for storing posts from source channels

CREATE TABLE IF NOT EXISTS public.source_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_channel_id uuid NOT NULL REFERENCES public.source_channels(id) ON DELETE CASCADE,
  bot_service_id uuid NOT NULL REFERENCES public.ai_bot_services(id) ON DELETE CASCADE,
  
  -- Original message data
  original_message_id bigint NOT NULL,
  text text,
  media_url text,
  media_type text, -- photo, video, document, etc
  has_media boolean DEFAULT false,
  
  -- Message metadata
  author_name text,
  views_count integer DEFAULT 0,
  forwards_count integer DEFAULT 0,
  posted_at timestamptz NOT NULL,
  
  -- Processing status
  is_processed boolean DEFAULT false,
  is_published boolean DEFAULT false,
  published_at timestamptz,
  published_message_id bigint,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Prevent duplicates
  UNIQUE(source_channel_id, original_message_id)
);

-- RLS Policies
ALTER TABLE public.source_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own source posts" ON public.source_posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.ai_bot_services
      WHERE ai_bot_services.id = source_posts.bot_service_id
        AND ai_bot_services.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all source posts" ON public.source_posts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX idx_source_posts_source_channel ON public.source_posts(source_channel_id);
CREATE INDEX idx_source_posts_bot_service ON public.source_posts(bot_service_id);
CREATE INDEX idx_source_posts_posted_at ON public.source_posts(posted_at DESC);
CREATE INDEX idx_source_posts_is_processed ON public.source_posts(is_processed) WHERE NOT is_processed;
CREATE INDEX idx_source_posts_is_published ON public.source_posts(is_published) WHERE NOT is_published;

-- Trigger for updated_at
CREATE TRIGGER update_source_posts_updated_at
  BEFORE UPDATE ON public.source_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function to get unprocessed posts count
CREATE OR REPLACE FUNCTION public.get_unprocessed_posts_count(service_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(*)::integer
  FROM public.source_posts
  WHERE bot_service_id = service_id
    AND is_processed = false;
$$;
