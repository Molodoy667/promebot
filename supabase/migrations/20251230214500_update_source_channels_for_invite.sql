-- Update source_channels table to support username/invite logic

-- Add new columns
ALTER TABLE public.source_channels 
ADD COLUMN IF NOT EXISTS channel_title text,
ADD COLUMN IF NOT EXISTS is_private boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS invite_hash text,
ADD COLUMN IF NOT EXISTS spammer_id uuid REFERENCES public.telegram_spammers(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS last_sync_at timestamptz;

-- Update channel_username to support both username and invite identifiers
COMMENT ON COLUMN public.source_channels.channel_username IS 'Username for public channels, invite_hash for private channels';
COMMENT ON COLUMN public.source_channels.channel_title IS 'Channel display name';
COMMENT ON COLUMN public.source_channels.is_private IS 'True if private channel (requires spammer)';
COMMENT ON COLUMN public.source_channels.invite_hash IS 'Invite hash for private channels';
COMMENT ON COLUMN public.source_channels.spammer_id IS 'Spammer used for private channel access';
COMMENT ON COLUMN public.source_channels.last_sync_at IS 'Last time posts were synced from this channel';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_source_channels_is_private ON public.source_channels(is_private);
CREATE INDEX IF NOT EXISTS idx_source_channels_spammer_id ON public.source_channels(spammer_id);
CREATE INDEX IF NOT EXISTS idx_source_channels_last_sync ON public.source_channels(last_sync_at);
