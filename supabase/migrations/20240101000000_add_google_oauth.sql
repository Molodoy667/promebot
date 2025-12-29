-- Add google_id field to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS google_id TEXT UNIQUE;

-- Add index for google_id
CREATE INDEX IF NOT EXISTS idx_profiles_google_id ON public.profiles(google_id);

-- Insert default Google OAuth settings
INSERT INTO public.app_settings (key, value)
VALUES (
  'google_oauth',
  '{
    "enabled": false,
    "client_id": "",
    "client_secret": "",
    "redirect_uri": ""
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;

-- Comment
COMMENT ON COLUMN public.profiles.google_id IS 'Google user ID for OAuth authentication';
