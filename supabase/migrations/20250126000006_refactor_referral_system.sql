-- Refactor referral system to use 8-character codes instead of links

-- 1. Add referral_code column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Add flag to track if user entered referral code
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS has_entered_referral BOOLEAN DEFAULT false;

-- 3. Create index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_profiles_referral_code 
ON public.profiles(referral_code) 
WHERE referral_code IS NOT NULL;

-- 4. Function to generate unique 8-character referral code
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed ambiguous: I, O, 0, 1
  result TEXT := '';
  i INTEGER;
  code_exists BOOLEAN;
BEGIN
  LOOP
    result := '';
    FOR i IN 1..8 LOOP
      result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- Check if code already exists
    SELECT EXISTS(
      SELECT 1 FROM public.profiles WHERE referral_code = result
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql VOLATILE;

-- 5. Update handle_new_user to generate referral code
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role, referral_code)
  VALUES (
    NEW.id, 
    'user',
    generate_referral_code()
  )
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Error creating profile: %', SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Generate referral codes for existing users
UPDATE public.profiles 
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- 7. Function to apply referral code
CREATE OR REPLACE FUNCTION public.apply_referral_code(
  p_user_id UUID,
  p_referral_code TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  referrer_id UUID
) AS $$
DECLARE
  v_referrer_id UUID;
  v_referrer_bonus DECIMAL := 50; -- Bonus for referrer
  v_referee_bonus DECIMAL := 25;  -- Bonus for new user
  v_user_ip TEXT;
BEGIN
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

  -- Update referrer (give bonus, increment count)
  UPDATE public.profiles
  SET 
    bonus_balance = COALESCE(bonus_balance, 0) + v_referrer_bonus,
    referrals_count = COALESCE(referrals_count, 0) + 1,
    updated_at = NOW()
  WHERE id = v_referrer_id;

  -- Create transactions
  INSERT INTO public.transactions (user_id, amount, type, description, balance_type)
  VALUES 
    (p_user_id, v_referee_bonus, 'referral_bonus', 'Бонус за реєстрацію за запрошенням', 'bonus'),
    (v_referrer_id, v_referrer_bonus, 'referral_reward', 'Винагорода за запрошення користувача', 'bonus');

  RETURN QUERY SELECT true, 'Реферальний код застосовано успішно!'::TEXT, v_referrer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Add comment
COMMENT ON COLUMN public.profiles.referral_code IS 'Unique 8-character referral code for this user';
COMMENT ON COLUMN public.profiles.has_entered_referral IS 'Whether user has entered someone else referral code';
