-- 1) Protect cleanup_tracker table with RLS restricted to service role
ALTER TABLE public.cleanup_tracker ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only service role can access cleanup_tracker" ON public.cleanup_tracker;

CREATE POLICY "Only service role can access cleanup_tracker"
  ON public.cleanup_tracker
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'service_role');


-- 2) Lock down password_reset_codes so only service role can access it
DROP POLICY IF EXISTS "Allow public insert for password reset codes" ON public.password_reset_codes;
DROP POLICY IF EXISTS "Allow public read for password reset codes" ON public.password_reset_codes;
DROP POLICY IF EXISTS "Allow public update for password reset codes" ON public.password_reset_codes;

ALTER TABLE public.password_reset_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Only service role can manage reset codes" ON public.password_reset_codes;

CREATE POLICY "Only service role can manage reset codes"
  ON public.password_reset_codes
  FOR ALL
  TO authenticated
  USING ((auth.jwt() ->> 'role') = 'service_role');


-- 3) Fix public referral lookup so it doesn't expose full profiles
-- Create safe view (drop+create to ensure correct definition)
DROP VIEW IF EXISTS public.referral_lookup;

CREATE VIEW public.referral_lookup AS
SELECT id, referral_code, full_name
FROM public.profiles
WHERE referral_code IS NOT NULL;

-- Remove overly permissive policy from profiles (name from scanner)
DROP POLICY IF EXISTS "Public can lookup referral code" ON public.profiles;

-- Create a SECURITY DEFINER function for looking up a single referral code
CREATE OR REPLACE FUNCTION public.lookup_referral(_code text)
RETURNS TABLE(id uuid, referral_code text, full_name text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, referral_code, full_name
  FROM public.profiles
  WHERE referral_code = _code
$$;