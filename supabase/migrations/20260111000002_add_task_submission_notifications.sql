-- Додаємо нові типи сповіщень (додаємо до існуючих)
-- Спочатку видаляємо старий constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Додаємо новий constraint з усіма існуючими та новими типами
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN (
    'ticket_reply', 
    'account_login', 
    'task_approved', 
    'task_rejected', 
    'system',
    'subscription_expiring',
    'subscription_expired',
    'balance_low',
    'bot_status_change',
    'bot_started',
    'bot_stopped',
    'bot_error',
    'tariff_expired',
    'vip_expired',
    'lottery_win',
    'task_new_submission',
    'task_submission_approved',
    'task_submission_rejected'
  ));

-- Тригер для сповіщення власника завдання про новий звіт
CREATE OR REPLACE FUNCTION notify_task_owner_new_submission()
RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
BEGIN
  -- Якщо статус змінився на submitted (новий звіт)
  IF NEW.status = 'submitted' AND (OLD.status IS NULL OR OLD.status != 'submitted') THEN
    -- Отримуємо інформацію про завдання
    SELECT * INTO v_task FROM tasks WHERE id = NEW.task_id;
    
    -- Створюємо сповіщення для власника завдання
    IF v_task.user_id != NEW.user_id THEN
      PERFORM create_notification(
        v_task.user_id,
        'task_new_submission',
        'Новий звіт до завдання',
        'На ваше завдання "' || v_task.title || '" надійшов новий звіт',
        '/task-marketplace?tab=my-tasks'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_submission_notify_owner ON task_submissions;
CREATE TRIGGER on_task_submission_notify_owner
  AFTER INSERT OR UPDATE ON task_submissions
  FOR EACH ROW
  WHEN (NEW.status = 'submitted')
  EXECUTE FUNCTION notify_task_owner_new_submission();

-- Тригер для сповіщення користувача про модерацію звіту
CREATE OR REPLACE FUNCTION notify_user_submission_moderation()
RETURNS TRIGGER AS $$
DECLARE
  v_task RECORD;
BEGIN
  -- Якщо статус змінився на approved або rejected
  IF NEW.status != OLD.status AND NEW.status IN ('approved', 'rejected') THEN
    -- Отримуємо інформацію про завдання
    SELECT * INTO v_task FROM tasks WHERE id = NEW.task_id;
    
    -- Створюємо сповіщення для користувача
    PERFORM create_notification(
      NEW.user_id,
      CASE 
        WHEN NEW.status = 'approved' THEN 'task_submission_approved'
        ELSE 'task_submission_rejected'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 'Звіт схвалено'
        ELSE 'Звіт відхилено'
      END,
      CASE 
        WHEN NEW.status = 'approved' THEN 
          'Ваш звіт для завдання "' || v_task.title || '" схвалено. Вам нараховано винагороду ' || v_task.reward_amount::TEXT || ' ₴'
        ELSE 
          'Ваш звіт для завдання "' || v_task.title || '" відхилено. Причина: ' || COALESCE(NEW.review_comment, 'Не вказано')
      END,
      '/task-marketplace?tab=my-submissions'
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_task_submission_moderation_notify ON task_submissions;
CREATE TRIGGER on_task_submission_moderation_notify
  AFTER UPDATE ON task_submissions
  FOR EACH ROW
  WHEN (NEW.status != OLD.status AND NEW.status IN ('approved', 'rejected'))
  EXECUTE FUNCTION notify_user_submission_moderation();
