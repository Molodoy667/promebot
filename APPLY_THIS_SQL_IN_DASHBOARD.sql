-- ⚠️ ВАЖЛИВО: Виконай це в Supabase Dashboard SQL Editor!
-- https://supabase.com/dashboard → твій проект → SQL Editor → New Query

-- 1. Drop old if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- 2. Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert profile with referral code
  INSERT INTO public.profiles (id, role, referral_code)
  VALUES (
    NEW.id, 
    'user',
    (SELECT public.generate_referral_code())
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log error but don't fail signup
  RAISE WARNING 'Error creating profile for user %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- 3. Create trigger on auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Verify it was created
SELECT 
  trigger_name, 
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created';

-- ✅ If you see one row with trigger_name = 'on_auth_user_created', it worked!
-- Now try registering a new user in the app.
