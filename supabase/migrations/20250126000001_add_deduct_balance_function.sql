-- Function to deduct balance (main or bonus)
CREATE OR REPLACE FUNCTION public.deduct_balance(
    user_id UUID,
    amount DECIMAL,
    balance_type TEXT DEFAULT 'main'
)
RETURNS BOOLEAN AS $$
DECLARE
    current_balance DECIMAL;
BEGIN
    -- Get current balance
    IF balance_type = 'bonus' THEN
        SELECT bonus_balance INTO current_balance
        FROM public.profiles
        WHERE id = user_id
        FOR UPDATE;
    ELSE
        SELECT balance INTO current_balance
        FROM public.profiles
        WHERE id = user_id
        FOR UPDATE;
    END IF;

    -- Check if enough balance
    IF current_balance < amount THEN
        RAISE EXCEPTION 'Insufficient balance';
    END IF;

    -- Deduct balance
    IF balance_type = 'bonus' THEN
        UPDATE public.profiles
        SET bonus_balance = bonus_balance - amount,
            updated_at = NOW()
        WHERE id = user_id;
    ELSE
        UPDATE public.profiles
        SET balance = balance - amount,
            updated_at = NOW()
        WHERE id = user_id;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
