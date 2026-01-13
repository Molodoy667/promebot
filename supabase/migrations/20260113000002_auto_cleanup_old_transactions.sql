-- Автоматичне видалення транзакцій старіше 30 днів (залишаємо тільки останні 10 для кожного користувача)
-- Зберігає тільки 10 найновіших транзакцій для кожного користувача

-- Функція для очищення старих транзакцій
CREATE OR REPLACE FUNCTION cleanup_old_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Видаляємо транзакції, залишаючи тільки 10 найновіших для кожного користувача
  DELETE FROM transactions
  WHERE id IN (
    SELECT id
    FROM (
      SELECT 
        id,
        ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as row_num
      FROM transactions
    ) ranked
    WHERE row_num > 10
  );
  
  RAISE NOTICE 'Old transactions cleaned up successfully';
END;
$$;

-- Створюємо cron job який запускається щодня о 3:00 ночі
SELECT cron.schedule(
  'cleanup-old-transactions',
  '0 3 * * *', -- Щодня о 3:00
  $$SELECT cleanup_old_transactions();$$
);

COMMENT ON FUNCTION cleanup_old_transactions IS 'Очищує старі транзакції, залишаючи тільки 10 найновіших для кожного користувача';
