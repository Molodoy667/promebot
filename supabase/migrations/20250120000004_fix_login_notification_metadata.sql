-- Оновлюємо функцію create_notification для підтримки metadata
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_notification_id UUID;
  v_settings RECORD;
BEGIN
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
    
    -- Створюємо сповіщення з metadata
    INSERT INTO notifications (user_id, type, title, message, link, metadata)
    VALUES (p_user_id, p_type, p_title, p_message, p_link, p_metadata)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Коментар
COMMENT ON FUNCTION create_notification IS 'Створює сповіщення з підтримкою metadata (IP, пристрій) та автоочищення старих логів входу';
