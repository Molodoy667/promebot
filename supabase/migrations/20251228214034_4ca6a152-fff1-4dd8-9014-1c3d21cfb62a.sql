-- Harden deduct_balance and create_notification functions

CREATE OR REPLACE FUNCTION public.deduct_balance(user_id uuid, amount numeric, balance_type text DEFAULT 'main'::text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    current_balance DECIMAL;
    caller_id uuid;
BEGIN
    -- Ensure caller is authenticated
    caller_id := auth.uid();
    IF caller_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- Authorization: allow self or admin only
    IF user_id IS NULL THEN
        user_id := caller_id;
    ELSIF user_id <> caller_id AND NOT public.has_role(caller_id, 'admin'::public.app_role) THEN
        RAISE EXCEPTION 'Unauthorized: cannot modify other users balance';
    END IF;

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
$$;

CREATE OR REPLACE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_link text DEFAULT NULL::text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notification_id UUID;
  v_settings RECORD;
  caller_id uuid;
BEGIN
  -- Authorization: allow system (no auth), self, or admin to target other users
  caller_id := auth.uid();
  IF caller_id IS NOT NULL THEN
    IF p_user_id IS NULL THEN
      p_user_id := caller_id;
    ELSIF p_user_id <> caller_id AND NOT public.has_role(caller_id, 'admin'::public.app_role) THEN
      RAISE EXCEPTION 'Unauthorized: cannot create notifications for other users';
    END IF;
  END IF;
  
  -- Перевіряємо налаштування користувача
  SELECT * INTO v_settings
  FROM notification_settings
  WHERE user_id = p_user_id;
  
  -- Якщо налаштувань немає, створюємо дефолтні
  IF NOT FOUND THEN
    INSERT INTO notification_settings (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_settings;
  END IF;
  
  -- Перевіряємо чи увімкнений тип сповіщення
  IF (p_type = 'ticket_reply' AND v_settings.ticket_reply_enabled) OR
     (p_type = 'account_login' AND v_settings.account_login_enabled) OR
     (p_type IN ('task_approved', 'task_rejected') AND v_settings.task_moderation_enabled) OR
     (p_type = 'system' AND v_settings.system_notifications_enabled) THEN
    
    -- Якщо це лог входу, видаляємо старі записи (залишаємо тільки 10 останніх)
    IF p_type = 'account_login' THEN
      DELETE FROM notifications
      WHERE id IN (
        SELECT id
        FROM notifications
        WHERE user_id = p_user_id AND type = 'account_login'
        ORDER BY created_at DESC
        OFFSET 10
      );
    END IF;
    
    -- Створюємо сповіщення
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (p_user_id, p_type, p_title, p_message, p_link)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
  END IF;
  
  RETURN NULL;
END;
$$;