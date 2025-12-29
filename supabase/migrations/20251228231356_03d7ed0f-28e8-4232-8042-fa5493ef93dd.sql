-- Update apply_referral_code to use referral_config settings, credit only bonus balance, and create transactions
DROP FUNCTION IF EXISTS public.apply_referral_code(p_referral_code text, p_user_id uuid);

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
  v_profile public.profiles%ROWTYPE;
BEGIN
  -- Load referral settings from app_settings (admin panel)
  SELECT value
  INTO v_referral_settings
  FROM public.app_settings
  WHERE key = 'referral_config'
  LIMIT 1;

  IF v_referral_settings IS NOT NULL THEN
    v_referrer_bonus := COALESCE((v_referral_settings->>'referrer_bonus')::numeric, v_referrer_bonus);
    v_referee_bonus := COALESCE((v_referral_settings->>'referee_bonus')::numeric, v_referee_bonus);
  END IF;

  -- Ensure user exists and hasn't already entered a referral
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'Користувача не знайдено';
    RETURN;
  END IF;

  IF COALESCE(v_profile.has_entered_referral, false) THEN
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

  -- Create referral record (store referrer's bonus amount)
  INSERT INTO public.referrals (referrer_id, referred_id, bonus_amount)
  VALUES (v_referrer_id, p_user_id, v_referrer_bonus)
  ON CONFLICT DO NOTHING;

  -- Apply bonuses ONLY to bonus_balance
  UPDATE public.profiles
  SET
    bonus_balance = COALESCE(bonus_balance, 0) + v_referee_bonus
  WHERE id = p_user_id;

  UPDATE public.profiles
  SET
    bonus_balance = COALESCE(bonus_balance, 0) + v_referrer_bonus
  WHERE id = v_referrer_id;

  -- Create transactions for history
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES 
    (
      p_user_id,
      v_referee_bonus,
      'referral_bonus',
      'Реферальний бонус за реєстрацію за кодом',
      'completed'
    ),
    (
      v_referrer_id,
      v_referrer_bonus,
      'referral_bonus',
      'Реферальний бонус за запрошення користувача',
      'completed'
    );

  RETURN QUERY SELECT true, 'Реферальний код успішно застосовано';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;