-- Add features JSON field to tariffs
ALTER TABLE public.tariffs 
ADD COLUMN IF NOT EXISTS features_list JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.tariffs.features_list IS 'List of tariff features with enabled/disabled status';

-- Create promo_codes table
CREATE TABLE IF NOT EXISTS public.promo_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT UNIQUE NOT NULL,
    discount_percent INTEGER NOT NULL CHECK (discount_percent > 0 AND discount_percent <= 100),
    discount_amount DECIMAL(10,2) CHECK (discount_amount >= 0),
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    applicable_tariffs UUID[] DEFAULT ARRAY[]::UUID[],
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast code lookup
CREATE INDEX IF NOT EXISTS idx_promo_codes_code ON public.promo_codes(code) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_promo_codes_valid ON public.promo_codes(valid_from, valid_until) WHERE is_active = true;

-- RLS for promo_codes
ALTER TABLE public.promo_codes ENABLE ROW LEVEL SECURITY;

-- Anyone can read active promo codes (to validate)
CREATE POLICY "Anyone can read active promo codes"
ON public.promo_codes FOR SELECT
USING (is_active = true AND (valid_until IS NULL OR valid_until > NOW()));

-- Only admins can manage promo codes
CREATE POLICY "Admins can manage promo codes"
ON public.promo_codes FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
);

-- Function to validate and apply promo code
CREATE OR REPLACE FUNCTION public.validate_promo_code(
    p_code TEXT,
    p_tariff_id UUID
)
RETURNS TABLE(
    is_valid BOOLEAN,
    discount_percent INTEGER,
    discount_amount DECIMAL,
    message TEXT
) AS $$
DECLARE
    v_promo public.promo_codes;
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

-- Function to increment promo code usage
CREATE OR REPLACE FUNCTION public.use_promo_code(p_code TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.promo_codes
    SET current_uses = current_uses + 1,
        updated_at = NOW()
    WHERE code = p_code
    AND is_active = true;
    
    RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update existing tariffs with features_list
UPDATE public.tariffs
SET features_list = jsonb_build_array(
    jsonb_build_object('key', 'media', 'label', 'Медіа контент', 'enabled', allow_media),
    jsonb_build_object('key', 'new_posts', 'label', 'Тільки нові пости', 'enabled', allow_new_posts_only),
    jsonb_build_object('key', 'keywords', 'label', 'Фільтр по ключовим словам', 'enabled', allow_keyword_filter),
    jsonb_build_object('key', 'scheduled', 'label', 'Відкладена публікація', 'enabled', allow_scheduled_posting),
    jsonb_build_object('key', 'as_channel', 'label', 'Публікація від імені каналу', 'enabled', allow_post_as_channel),
    jsonb_build_object('key', 'auto_delete', 'label', 'Автовидалення постів', 'enabled', allow_auto_delete),
    jsonb_build_object('key', 'watermark', 'label', 'Кастомний водяний знак', 'enabled', allow_custom_watermark),
    jsonb_build_object('key', 'link_preview', 'label', 'Попередній перегляд посилань', 'enabled', allow_link_preview),
    jsonb_build_object('key', 'forward_tag', 'label', 'Тег пересилання', 'enabled', allow_forward_tag),
    jsonb_build_object('key', 'edit_before', 'label', 'Редагування перед публікацією', 'enabled', allow_edit_before_post)
)
WHERE features_list IS NULL OR features_list = '[]'::jsonb;
