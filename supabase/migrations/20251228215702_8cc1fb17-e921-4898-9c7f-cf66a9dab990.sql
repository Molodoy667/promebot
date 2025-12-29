CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_referral_code text,
  p_user_id uuid
)
RETURNS TABLE(success boolean, message text, referrer_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_id UUID;
  v_referrer_bonus DECIMAL := 50; -- default bonus for referrer
  v_referee_bonus DECIMAL := 25;  -- default bonus for new user
  v_user_ip TEXT;
  v_settings JSONB;
BEGIN
  -- Load referral settings from app_settings if present
  SELECT value INTO v_settings
  FROM public.app_settings
  WHERE key = 'referral_settings'
  LIMIT 1;

  IF v_settings IS NOT NULL THEN
    v_referrer_bonus := COALESCE((v_settings->>'referrer_bonus')::DECIMAL, v_referrer_bonus);
    v_referee_bonus := COALESCE((v_settings->>'referee_bonus')::DECIMAL, v_referee_bonus);
  END IF;

  -- Check if user already entered a referral code
  IF EXISTS(
    SELECT 1 FROM public.profiles 
    WHERE id = p_user_id 
      AND has_entered_referral = true
  ) THEN
    RETURN QUERY SELECT false, 'Ви вже використали реферальний код'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Find referrer by code
  SELECT id INTO v_referrer_id
  FROM public.profiles
  WHERE referral_code = UPPER(p_referral_code)
    AND id != p_user_id; -- Can't refer yourself

  IF v_referrer_id IS NULL THEN
    RETURN QUERY SELECT false, 'Невірний реферальний код'::TEXT, NULL::UUID;
    RETURN;
  END IF;

  -- Check for IP duplicates (if user has registration_ip)
  SELECT registration_ip INTO v_user_ip
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_user_ip IS NOT NULL THEN
    -- Check if someone from this IP already used this referrer's code
    IF EXISTS(
      SELECT 1 FROM public.profiles
      WHERE referred_by = v_referrer_id
        AND registration_ip = v_user_ip
        AND id != p_user_id
    ) THEN
      RETURN QUERY SELECT false, 'З вашої IP адреси вже зареєстровано акаунт за цим реферальним кодом'::TEXT, NULL::UUID;
      RETURN;
    END IF;
  END IF;

  -- Update referee (mark as entered, give bonus)
  UPDATE public.profiles
  SET 
    referred_by = v_referrer_id,
    has_entered_referral = true,
    bonus_balance = COALESCE(bonus_balance, 0) + v_referee_bonus,
    updated_at = NOW()
  WHERE id = p_user_id;

  -- Update referrer (give bonus)
  UPDATE public.profiles
  SET 
    bonus_balance = COALESCE(bonus_balance, 0) + v_referrer_bonus,
    updated_at = NOW()
  WHERE id = v_referrer_id;

  -- Create transactions
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES 
    (p_user_id, v_referee_bonus, 'referral_bonus', 'Бонус за реєстрацію за запрошенням', 'completed'),
    (v_referrer_id, v_referrer_bonus, 'referral_reward', 'Винагорода за запрошення користувача', 'completed');

  RETURN QUERY SELECT true, 'Реферальний код застосовано успішно!'::TEXT, v_referrer_id;
END;
$$;