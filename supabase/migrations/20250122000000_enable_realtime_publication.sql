-- Додати таблицю notifications до realtime публікації
-- Це необхідно для отримання INSERT/UPDATE/DELETE подій через Supabase Realtime

-- Спочатку видаляємо якщо вже є (ігноруємо помилку)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE notifications;
    RAISE NOTICE 'Notifications table removed from publication';
EXCEPTION
    WHEN undefined_table THEN
        RAISE NOTICE 'Table was not in publication, continuing';
    WHEN undefined_object THEN
        RAISE NOTICE 'Table was not in publication, continuing';
END $$;

-- Додаємо таблицю до публікації
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;

-- Перевіряємо що REPLICA IDENTITY встановлено
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Коментар
COMMENT ON TABLE notifications IS 
  'Таблиця сповіщень з увімкненим Realtime (включена в publication)';
