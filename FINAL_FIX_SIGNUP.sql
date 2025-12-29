-- ⚠️ ВИКОНАЙ ЦЕ В SUPABASE DASHBOARD SQL EDITOR!

-- 1. Create generate_referral_code function first
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    SELECT EXISTS(
      SELECT 1 FROM public.profiles WHERE referral_code = result
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 2. Add columns to profiles if not exist
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_entered_referral BOOLEAN DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_profiles_referral_code 
ON public.profiles(referral_code) 
WHERE referral_code IS NOT NULL;

-- 3. Generate codes for existing users
UPDATE public.profiles 
SET referral_code = public.generate_referral_code()
WHERE referral_code IS NULL;

-- 4. Drop and recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, referral_code)
  VALUES (
    NEW.id, 
    'user',
    public.generate_referral_code()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating profile: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Verify
SELECT 'Function exists:' as check, COUNT(*)::text as result
FROM pg_proc WHERE proname = 'generate_referral_code'
UNION ALL
SELECT 'Trigger exists:', COUNT(*)::text
FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created';

-- ✅ Should see 2 rows with result = '1' for both
