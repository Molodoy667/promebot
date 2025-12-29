-- Add missing bot error notification helper
CREATE OR REPLACE FUNCTION public.create_bot_error_notification(
  p_user_id UUID,
  p_bot_name TEXT,
  p_channel_name TEXT,
  p_error_message TEXT,
  p_service_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bot_status_enabled BOOLEAN;
BEGIN
  -- Ensure notification settings exist
  SELECT COALESCE(bot_status_enabled, true)
    INTO v_bot_status_enabled
  FROM public.notification_settings
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.notification_settings (user_id)
    VALUES (p_user_id)
    RETURNING COALESCE(bot_status_enabled, true) INTO v_bot_status_enabled;
  END IF;

  IF v_bot_status_enabled THEN
    INSERT INTO public.notifications (
      user_id,
      type,
      title,
      message,
      link
    ) VALUES (
      p_user_id,
      'bot_error',
      '❌ Помилка бота',
      format(
        'У бота "%s" (канал "%s") виникла помилка: %s. Зверніться в службу підтримки',
        p_bot_name,
        p_channel_name,
        COALESCE(p_error_message, 'Невідома помилка')
      ),
      '/create-ticket'
    );
  END IF;
END;
$$;

-- Allow client-side calls too (optional)
GRANT EXECUTE ON FUNCTION public.create_bot_error_notification(UUID, TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
