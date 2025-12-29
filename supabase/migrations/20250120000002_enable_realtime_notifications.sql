-- Увімкнення Realtime для таблиці notifications
-- Це дозволяє отримувати INSERT/UPDATE/DELETE події в реальному часі

-- Встановлюємо REPLICA IDENTITY для відстеження змін
ALTER TABLE notifications REPLICA IDENTITY FULL;

-- Коментар для пояснення
COMMENT ON TABLE notifications IS 
  'Таблиця сповіщень з увімкненим Realtime для миттєвого оновлення UI';
