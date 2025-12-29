-- Додаємо тип сповіщення для входу в систему
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'notification_type'
  ) THEN
    CREATE TYPE notification_type AS ENUM (
      'task_submission',
      'task_approved',
      'task_rejected',
      'ticket_reply',
      'system_announcement',
      'balance_change',
      'account_login'
    );
  ELSE
    -- Якщо тип вже існує, додаємо нове значення
    ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'account_login';
  END IF;
END $$;

-- Додаємо налаштування для звуку сповіщень
INSERT INTO app_settings (key, value)
VALUES (
  'notifications_sound_enabled',
  'true'::jsonb
)
ON CONFLICT (key) DO NOTHING;
