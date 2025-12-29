-- Додаємо поле для сповіщень про статус ботів
ALTER TABLE notification_settings 
ADD COLUMN IF NOT EXISTS bot_status_enabled BOOLEAN DEFAULT true;

-- Додаємо поле started_at до таблиць ботів для відстеження часу роботи
ALTER TABLE bot_services 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

ALTER TABLE ai_bot_services 
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;

-- Додаємо нові типи сповіщень для ботів
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN (
  'system',
  'ticket_reply',
  'account_login',
  'task_approved',
  'task_rejected',
  'lottery_win',
  'tariff_expired',
  'vip_expired',
  'vip_purchase',
  'tariff_purchase',
  'bot_started',
  'bot_stopped',
  'bot_error'
));

-- Функція для створення сповіщення про запуск бота
CREATE OR REPLACE FUNCTION create_bot_started_notification(
  p_user_id UUID,
  p_bot_name TEXT,
  p_channel_name TEXT,
  p_service_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot_status_enabled BOOLEAN;
BEGIN
  -- Перевіряємо чи увімкнені сповіщення про статус ботів
  SELECT COALESCE(bot_status_enabled, true)
  INTO v_bot_status_enabled
  FROM notification_settings
  WHERE user_id = p_user_id;
  
  -- Якщо увімкнено - створюємо сповіщення
  IF v_bot_status_enabled THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link
    ) VALUES (
      p_user_id,
      'bot_started',
      '🤖 Бот запущено',
      format('Бот "%s" прив''язаний до каналу "%s" розпочав свою роботу', p_bot_name, p_channel_name),
      CASE 
        WHEN p_service_type = 'ai' THEN '/ai-chat'
        ELSE '/my-channels'
      END
    );
  END IF;
END;
$$;

-- Функція для створення сповіщення про зупинку бота
CREATE OR REPLACE FUNCTION create_bot_stopped_notification(
  p_user_id UUID,
  p_bot_name TEXT,
  p_channel_name TEXT,
  p_runtime_hours NUMERIC,
  p_service_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot_status_enabled BOOLEAN;
  v_runtime_text TEXT;
BEGIN
  -- Перевіряємо чи увімкнені сповіщення про статус ботів
  SELECT COALESCE(bot_status_enabled, true)
  INTO v_bot_status_enabled
  FROM notification_settings
  WHERE user_id = p_user_id;
  
  -- Форматуємо час роботи
  IF p_runtime_hours >= 24 THEN
    v_runtime_text := format('%s днів %s годин', 
      FLOOR(p_runtime_hours / 24)::INTEGER, 
      (p_runtime_hours % 24)::INTEGER
    );
  ELSIF p_runtime_hours >= 1 THEN
    v_runtime_text := format('%s годин %s хвилин', 
      FLOOR(p_runtime_hours)::INTEGER, 
      ROUND((p_runtime_hours % 1) * 60)::INTEGER
    );
  ELSE
    v_runtime_text := format('%s хвилин', ROUND(p_runtime_hours * 60)::INTEGER);
  END IF;
  
  -- Якщо увімкнено - створюємо сповіщення
  IF v_bot_status_enabled THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link
    ) VALUES (
      p_user_id,
      'bot_stopped',
      '⏸️ Бот зупинено',
      format('Бот "%s" прив''язаний до каналу "%s" припинив свою роботу, пропрацювавши %s', 
        p_bot_name, p_channel_name, v_runtime_text),
      CASE 
        WHEN p_service_type = 'ai' THEN '/ai-chat'
        ELSE '/my-channels'
      END
    );
  END IF;
END;
$$;

-- Функція для створення сповіщення про помилку бота
CREATE OR REPLACE FUNCTION create_bot_error_notification(
  p_user_id UUID,
  p_bot_name TEXT,
  p_channel_name TEXT,
  p_error_message TEXT,
  p_service_type TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bot_status_enabled BOOLEAN;
BEGIN
  -- Перевіряємо чи увімкнені сповіщення про статус ботів
  SELECT COALESCE(bot_status_enabled, true)
  INTO v_bot_status_enabled
  FROM notification_settings
  WHERE user_id = p_user_id;
  
  -- Якщо увімкнено - створюємо сповіщення
  IF v_bot_status_enabled THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link
    ) VALUES (
      p_user_id,
      'bot_error',
      '❌ Помилка бота',
      format('У бота "%s" (канал "%s") виникла помилка: %s. Зверніться в службу підтримки', 
        p_bot_name, p_channel_name, COALESCE(p_error_message, 'Невідома помилка')),
      '/create-ticket'
    );
  END IF;
END;
$$;

-- Надаємо права на виконання функцій
GRANT EXECUTE ON FUNCTION create_bot_started_notification TO authenticated;
GRANT EXECUTE ON FUNCTION create_bot_started_notification TO service_role;

GRANT EXECUTE ON FUNCTION create_bot_stopped_notification TO authenticated;
GRANT EXECUTE ON FUNCTION create_bot_stopped_notification TO service_role;

GRANT EXECUTE ON FUNCTION create_bot_error_notification TO authenticated;
GRANT EXECUTE ON FUNCTION create_bot_error_notification TO service_role;

-- Коментарі
COMMENT ON FUNCTION create_bot_started_notification IS 'Створює сповіщення про запуск бота';
COMMENT ON FUNCTION create_bot_stopped_notification IS 'Створює сповіщення про зупинку бота з часом роботи';
COMMENT ON FUNCTION create_bot_error_notification IS 'Створює сповіщення про помилку бота';
