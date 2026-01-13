-- Fix create_notification function to support subscription expiration notifications
-- The function was checking only old notification types and ignoring tariff_expired, vip_expired

CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type TEXT,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT DEFAULT NULL
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
  -- Для старих типів перевіряємо налаштування
  -- Для нових типів (bot_*, tariff_*, vip_*, lottery_*, task_*) перевіряємо відповідні колонки або дозволяємо за замовчуванням
  IF (p_type = 'ticket_reply' AND COALESCE(v_settings.ticket_reply_enabled, true)) OR
     (p_type = 'account_login' AND COALESCE(v_settings.account_login_enabled, true)) OR
     (p_type IN ('task_approved', 'task_rejected') AND COALESCE(v_settings.task_moderation_enabled, true)) OR
     (p_type IN ('bot_started', 'bot_stopped', 'bot_error') AND COALESCE(v_settings.bot_status_enabled, true)) OR
     (p_type = 'system' AND COALESCE(v_settings.system_notifications_enabled, true)) OR
     -- Для subscription expiration завжди створюємо сповіщення (критично важливо)
     (p_type IN ('tariff_expired', 'vip_expired', 'subscription_expiring', 'subscription_expired')) OR
     -- Для інших типів (lottery_win, task_new_submission, task_submission_approved, task_submission_rejected) - за замовчуванням увімкнені
     (p_type IN ('lottery_win', 'task_new_submission', 'task_submission_approved', 'task_submission_rejected', 'balance_low', 'bot_status_change')) THEN
    
    -- Створюємо сповіщення
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (p_user_id, p_type, p_title, p_message, p_link)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Оновлюємо коментар
COMMENT ON FUNCTION create_notification IS 'Створює сповіщення для користувача з перевіркою налаштувань. Сповіщення про закінчення підписок створюються завжди.';
