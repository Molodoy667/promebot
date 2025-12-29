-- Add referral commission system for tariff purchases

-- Function to award referral commission when referee purchases a tariff
CREATE OR REPLACE FUNCTION public.award_referral_commission()
RETURNS TRIGGER AS $$
DECLARE
  v_referrer_id uuid;
  v_tariff_price numeric;
  v_commission_percent numeric := 10;
  v_commission_amount numeric;
  v_referral_settings jsonb;
  v_tariff_name text;
BEGIN
  -- Only process active subscriptions
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Skip if already processed (updating existing active subscription)
  IF OLD.status = 'active' THEN
    RETURN NEW;
  END IF;

  -- Get referrer from profiles
  SELECT referred_by INTO v_referrer_id
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- No referrer, skip
  IF v_referrer_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get commission settings from app_settings
  SELECT value INTO v_referral_settings
  FROM public.app_settings
  WHERE key = 'referral_config'
  LIMIT 1;

  IF v_referral_settings IS NOT NULL THEN
    v_commission_percent := COALESCE((v_referral_settings->>'tariff_commission_percent')::numeric, 10);
  END IF;

  -- Get tariff price and name
  SELECT price, name INTO v_tariff_price, v_tariff_name
  FROM public.tariffs
  WHERE id = NEW.tariff_id;

  IF v_tariff_price IS NULL OR v_tariff_price <= 0 THEN
    RETURN NEW;
  END IF;

  -- Calculate commission
  v_commission_amount := v_tariff_price * (v_commission_percent / 100.0);

  -- Award commission to referrer's bonus balance
  UPDATE public.profiles
  SET bonus_balance = COALESCE(bonus_balance, 0) + v_commission_amount
  WHERE id = v_referrer_id;

  -- Create transaction record for referrer
  INSERT INTO public.transactions (user_id, amount, type, description, status)
  VALUES (
    v_referrer_id,
    v_commission_amount,
    'referral_commission',
    'Комісія ' || v_commission_percent || '% від покупки тарифу "' || v_tariff_name || '" вашим рефералом',
    'completed'
  );

  -- Update referral record with commission amount
  UPDATE public.referrals
  SET bonus_amount = COALESCE(bonus_amount, 0) + v_commission_amount
  WHERE referrer_id = v_referrer_id AND referred_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on subscriptions
DROP TRIGGER IF EXISTS trigger_award_referral_commission ON public.subscriptions;
CREATE TRIGGER trigger_award_referral_commission
  AFTER INSERT OR UPDATE OF status ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.award_referral_commission();