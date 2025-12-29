-- Створення таблиці сповіщень
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('ticket_reply', 'account_login', 'task_approved', 'task_rejected', 'system')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Створення таблиці налаштувань сповіщень
CREATE TABLE IF NOT EXISTS notification_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ticket_reply_enabled BOOLEAN DEFAULT TRUE,
  account_login_enabled BOOLEAN DEFAULT TRUE,
  task_moderation_enabled BOOLEAN DEFAULT TRUE,
  system_notifications_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Індекси для швидкого доступу
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = FALSE;

-- RLS політики для notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

-- RLS політики для notification_settings
ALTER TABLE notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notification settings"
  ON notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notification settings"
  ON notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own notification settings"
  ON notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Функція для створення дефолтних налаштувань при реєстрації
CREATE OR REPLACE FUNCTION create_default_notification_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notification_settings (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригер для автоматичного створення налаштувань
DROP TRIGGER IF EXISTS on_auth_user_created_notification_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_notification_settings
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_notification_settings();

-- Функція для створення сповіщення
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
  IF (p_type = 'ticket_reply' AND v_settings.ticket_reply_enabled) OR
     (p_type = 'account_login' AND v_settings.account_login_enabled) OR
     (p_type IN ('task_approved', 'task_rejected') AND v_settings.task_moderation_enabled) OR
     (p_type = 'system' AND v_settings.system_notifications_enabled) THEN
    
    -- Створюємо сповіщення
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (p_user_id, p_type, p_title, p_message, p_link)
    RETURNING id INTO v_notification_id;
    
    RETURN v_notification_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функція для позначення сповіщення як прочитаного
CREATE OR REPLACE FUNCTION mark_notification_read(p_notification_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE id = p_notification_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функція для позначення всіх сповіщень як прочитаних
CREATE OR REPLACE FUNCTION mark_all_notifications_read()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE notifications
  SET is_read = TRUE, read_at = NOW()
  WHERE user_id = auth.uid() AND is_read = FALSE;
  
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Функція для отримання кількості непрочитаних сповіщень
CREATE OR REPLACE FUNCTION get_unread_notifications_count()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO v_count
  FROM notifications
  WHERE user_id = auth.uid() AND is_read = FALSE;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Тригер для створення сповіщення при відповіді на тікет
CREATE OR REPLACE FUNCTION notify_on_ticket_reply()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  -- Якщо це відповідь адміна і є непрочитані відповіді
  IF NEW.unread_admin_replies > OLD.unread_admin_replies THEN
    SELECT * INTO v_ticket FROM tickets WHERE id = NEW.id;
    
    PERFORM create_notification(
      v_ticket.user_id,
      'ticket_reply',
      'Нова відповідь на тікет',
      'Адміністратор відповів на ваш тікет "' || v_ticket.subject || '"',
      '/tickets'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_ticket_reply_notify ON tickets;
CREATE TRIGGER on_ticket_reply_notify
  AFTER UPDATE ON tickets
  FOR EACH ROW
  WHEN (NEW.unread_admin_replies > OLD.unread_admin_replies)
  EXECUTE FUNCTION notify_on_ticket_reply();

-- Тригер для створення сповіщення при модерації завдання
CREATE OR REPLACE FUNCTION notify_on_task_moderation()
RETURNS TRIGGER AS $$
BEGIN
  -- Якщо статус змінився на approved або rejected
  IF NEW.status != OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    PERFORM create_notification(
      NEW.user_id,
      CASE 
        WHEN NEW.status = 'approved' THEN 'task_approved'
        ELSE 'task_rejected'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Завдання схвалено'
        ELSE 'Завдання відхилено'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Ваше завдання було схвалено модератором'
        ELSE 'Ваше завдання було відхилено. Причина: ' || COALESCE(NEW.rejection_reason, 'Не вказано')
      END,
      '/tasks/marketplace'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_moderation_notify ON tasks;
CREATE TRIGGER on_task_moderation_notify
  AFTER UPDATE ON tasks
  FOR EACH ROW
  WHEN (NEW.status != OLD.status AND NEW.status IN ('approved', 'rejected'))
  EXECUTE FUNCTION notify_on_task_moderation();
