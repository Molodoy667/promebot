-- Додаємо політику DELETE для таблиці notifications
-- Дозволяє користувачам видаляти свої власні сповіщення

DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

CREATE POLICY "Users can delete own notifications"
  ON notifications FOR DELETE
  USING (auth.uid() = user_id);

-- Коментар для пояснення
COMMENT ON POLICY "Users can delete own notifications" ON notifications IS 
  'Дозволяє користувачам видаляти власні сповіщення для очищення історії';
