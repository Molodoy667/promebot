-- Add role column to profiles if not exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';

-- Create index for faster role queries
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Add comment
COMMENT ON COLUMN public.profiles.role IS 'User role: user, moderator, admin';

-- Set first user as admin (if exists)
UPDATE public.profiles 
SET role = 'admin' 
WHERE id IN (
  SELECT id FROM public.profiles 
  ORDER BY created_at ASC 
  LIMIT 1
);
