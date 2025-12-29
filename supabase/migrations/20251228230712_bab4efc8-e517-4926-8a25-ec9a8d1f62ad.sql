-- Fix ambiguous overloaded apply_referral_code and ensure it uses referral_settings from app_settings

-- 1. Drop existing overloaded variants
DROP FUNCTION IF EXISTS public.apply_referral_code(p_user_id uuid, p_referral_code text);
DROP FUNCTION IF EXISTS public.apply_referral_code(p_referral_code text, p_user_id uuid);

-- 2. Recreate a single canonical function
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referral_code text,
  p_user_id uuid
)
RETURNS TABLE(success boolean, message text) AS $$
DECLARE
  v_referrer_id uuid;
  v_referral_settings jsonb;
  v_referrer_bonus numeric := 50;
  v_referee_bonus numeric := 25;
BEGIN
  -- Load referral settings from app_settings (admin panel)
  SELECT value
  INTO v_referral_settings
  FROM public.app_settings
  WHERE key = 'referral_settings'
  LIMIT 1;

  IF v_referral_settings IS NOT NULL THEN
    v_referrer_bonus := COALESCE((v_referral_settings->>'referrer_bonus')::numeric, v_referrer_bonus);
    v_referee_bonus := COALESCE((v_referral_settings->>'referee_bonus')::numeric, v_referee_bonus);
  END IF;

  -- Ensure user exists and hasn't already entered a referral
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = p_user_id AND has_entered_referral = true
  ) THEN
    RETURN QUERY SELECT false, 'Ви вже використали реферальний код';
    RETURN;
  END IF;

  -- Find referrer by referral_code
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = p_referral_code;

  IF v_referrer_id IS NULL THEN
    RETURN QUERY SELECT false, 'Невірний реферальний код';
    RETURN;
  END IF;

  -- Prevent self-referral
  IF v_referrer_id = p_user_id THEN
    RETURN QUERY SELECT false, 'Не можна використати власний реферальний код';
    RETURN;
  END IF;

  -- Mark profile as having entered referral & link referrer
  UPDATE public.profiles
  SET
    has_entered_referral = true,
    referred_by = v_referrer_id
  WHERE id = p_user_id;

  -- Create referral record
  INSERT INTO public.referrals (referrer_id, referred_id, bonus_amount)
  VALUES (v_referrer_id, p_user_id, v_referrer_bonus)
  ON CONFLICT DO NOTHING;

  -- Apply bonuses
  UPDATE public.profiles
  SET
    bonus_balance = COALESCE(bonus_balance, 0) + v_referee_bonus,
    balance = COALESCE(balance, 0) + v_referee_bonus
  WHERE id = p_user_id;

  UPDATE public.profiles
  SET
    bonus_balance = COALESCE(bonus_balance, 0) + v_referrer_bonus,
    balance = COALESCE(balance, 0) + v_referrer_bonus
  WHERE id = v_referrer_id;

  RETURN QUERY SELECT true, 'Реферальний код успішно застосовано';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;