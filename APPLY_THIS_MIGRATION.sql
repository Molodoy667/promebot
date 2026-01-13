-- =====================================================
-- ЗАСТОСУЙ ЦЕЙ SQL В DASHBOARD
-- https://vtrkcgaajgtlkjqcnwxk.supabase.co/project/vtrkcgaajgtlkjqcnwxk/sql/new
-- =====================================================

-- Функція для автоочищення транзакцій (залишає останні 10 для кожного користувача)
CREATE OR REPLACE FUNCTION cleanup_old_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM transactions WHERE id IN (
    SELECT id FROM (
      SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at DESC) as row_num
      FROM transactions
    ) ranked WHERE row_num > 10
  );
  RAISE NOTICE 'Cleaned up old transactions';
END;
$$;

-- Створюємо cron job (щодня о 3:00 ночі)
-- Якщо вже існує - нічого не станеться
DO $$
BEGIN
  PERFORM cron.unschedule('cleanup-old-transactions');
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'cleanup-old-transactions',
  '0 3 * * *',
  $$SELECT cleanup_old_transactions();$$
);

COMMENT ON FUNCTION cleanup_old_transactions IS 'Автоочищення транзакцій - залишає останні 10 для кожного користувача';
