-- Fix the transaction type CHECK constraint to include missing types
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_type_check;

ALTER TABLE public.transactions ADD CONSTRAINT transactions_type_check CHECK (
  type = ANY (ARRAY[
    'deposit'::text, 
    'withdrawal'::text, 
    'bonus'::text, 
    'subscription'::text, 
    'tariff_purchase'::text, 
    'referral_bonus'::text, 
    'referral_commission'::text,
    'purchase_bonus'::text,
    'roulette_win'::text, 
    'reward'::text, 
    'task_reward'::text, 
    'task_payment'::text, 
    'task_budget'::text, 
    'task_budget_withdrawal'::text, 
    'ai_image_generation'::text, 
    'lottery_ticket'::text, 
    'lottery_win'::text, 
    'vip_subscription'::text,
    'ai_post_generation'::text,
    'ai_chat_rental'::text,
    'expense'::text
  ])
);

-- Fix the purchase bonus trigger to handle null tariff_price properly
CREATE OR REPLACE FUNCTION public.handle_tariff_purchase_bonus()
RETURNS TRIGGER AS $$
DECLARE
  v_bonus_amount numeric;
  v_tariff_price numeric;
  v_bonus_percent numeric;
BEGIN
  -- Only process completed transactions for tariff purchases
  IF NEW.type = 'tariff_purchase' AND NEW.status = 'completed' THEN
    -- Get the tariff price from transaction metadata or from amount
    v_tariff_price := COALESCE(
      (NEW.metadata->>'tariff_price')::numeric,
      ABS(NEW.amount)
    );
    
    -- Skip if no valid price
    IF v_tariff_price IS NULL OR v_tariff_price <= 0 THEN
      RETURN NEW;
    END IF;
    
    -- Get bonus percent from app_settings
    SELECT (value->>'bonus_percent')::numeric
    INTO v_bonus_percent
    FROM app_settings
    WHERE key = 'tariff_purchase_bonus'
    LIMIT 1;
    
    -- Default to 5 if not found
    v_bonus_percent := COALESCE(v_bonus_percent, 5);
    
    -- Calculate bonus
    v_bonus_amount := v_tariff_price * (v_bonus_percent / 100);
    
    -- Skip if bonus would be zero
    IF v_bonus_amount <= 0 THEN
      RETURN NEW;
    END IF;
    
    -- Add bonus to user's bonus_balance
    UPDATE profiles
    SET bonus_balance = COALESCE(bonus_balance, 0) + v_bonus_amount
    WHERE id = NEW.user_id;
    
    -- Create transaction for purchase bonus
    INSERT INTO transactions (user_id, type, amount, status, description, metadata)
    VALUES (
      NEW.user_id,
      'purchase_bonus',
      v_bonus_amount,
      'completed',
      'Бонус ' || v_bonus_percent || '% за покупку тарифу',
      jsonb_build_object('tariff_price', v_tariff_price, 'bonus_percent', v_bonus_percent)
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;