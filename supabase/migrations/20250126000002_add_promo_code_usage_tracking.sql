-- Table to track promo code usage per user
CREATE TABLE IF NOT EXISTS public.promo_code_uses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promo_code_id UUID REFERENCES public.promo_codes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    used_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(promo_code_id, user_id)
);

-- Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_user ON public.promo_code_uses(user_id);
CREATE INDEX IF NOT EXISTS idx_promo_code_uses_promo ON public.promo_code_uses(promo_code_id);

-- RLS
ALTER TABLE public.promo_code_uses ENABLE ROW LEVEL SECURITY;

-- Users can see their own usage
CREATE POLICY "Users can see own promo usage"
ON public.promo_code_uses FOR SELECT
USING (auth.uid() = user_id);

-- Only system can insert
CREATE POLICY "System can insert promo usage"
ON public.promo_code_uses FOR INSERT
WITH CHECK (true);

-- Update validate_promo_code to check per-user usage
CREATE OR REPLACE FUNCTION public.validate_promo_code(
    p_code TEXT,
    p_tariff_id UUID,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE(
    is_valid BOOLEAN,
    discount_percent INTEGER,
    discount_amount DECIMAL,
    message TEXT
) AS $$
DECLARE
    v_promo public.promo_codes;
    v_already_used BOOLEAN;
BEGIN
    -- Get promo code
    SELECT * INTO v_promo
    FROM public.promo_codes
    WHERE code = p_code
    AND is_active = true
    AND (valid_from IS NULL OR valid_from <= NOW())
    AND (valid_until IS NULL OR valid_until > NOW());

    -- Check if promo exists
    IF v_promo.id IS NULL THEN
        RETURN QUERY SELECT false, 0, 0::DECIMAL, 'Промокод не знайдено або він неактивний';
        RETURN;
    END IF;

    -- Check if user already used this promo code
    IF p_user_id IS NOT NULL THEN
        SELECT EXISTS(
            SELECT 1 FROM public.promo_code_uses
            WHERE promo_code_id = v_promo.id
            AND user_id = p_user_id
        ) INTO v_already_used;

        IF v_already_used THEN
            RETURN QUERY SELECT false, 0, 0::DECIMAL, 'Ви вже використали цей промокод';
            RETURN;
        END IF;
    END IF;

    -- Check max uses
    IF v_promo.max_uses IS NOT NULL AND v_promo.current_uses >= v_promo.max_uses THEN
        RETURN QUERY SELECT false, 0, 0::DECIMAL, 'Промокод вичерпав ліміт використань';
        RETURN;
    END IF;

    -- Check applicable tariffs
    IF array_length(v_promo.applicable_tariffs, 1) > 0 
       AND NOT (p_tariff_id = ANY(v_promo.applicable_tariffs)) THEN
        RETURN QUERY SELECT false, 0, 0::DECIMAL, 'Промокод не застосовується до цього тарифу';
        RETURN;
    END IF;

    -- Valid promo code
    RETURN QUERY SELECT 
        true,
        COALESCE(v_promo.discount_percent, 0),
        COALESCE(v_promo.discount_amount, 0::DECIMAL),
        'Промокод успішно застосовано'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update use_promo_code to track user usage
CREATE OR REPLACE FUNCTION public.use_promo_code(
    p_code TEXT,
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
    v_promo_id UUID;
BEGIN
    -- Get promo code ID
    SELECT id INTO v_promo_id
    FROM public.promo_codes
    WHERE code = p_code
    AND is_active = true;

    IF v_promo_id IS NULL THEN
        RETURN false;
    END IF;

    -- Record usage
    INSERT INTO public.promo_code_uses (promo_code_id, user_id)
    VALUES (v_promo_id, p_user_id)
    ON CONFLICT (promo_code_id, user_id) DO NOTHING;

    -- Increment counter
    UPDATE public.promo_codes
    SET current_uses = current_uses + 1,
        updated_at = NOW()
    WHERE id = v_promo_id;
    
    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
