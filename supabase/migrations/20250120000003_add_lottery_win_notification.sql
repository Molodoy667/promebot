-- Додаємо системне сповіщення при виграші в лотереї
-- Winner зберігається в lottery_rounds, тому відстежуємо зміни там

-- Створюємо або оновлюємо функцію для відправки сповіщення переможцю
CREATE OR REPLACE FUNCTION notify_lottery_winner()
RETURNS TRIGGER AS $$
BEGIN
  -- Перевіряємо чи раунд завершився і є переможець
  IF NEW.status = 'completed' AND NEW.winner_id IS NOT NULL AND 
     (OLD.winner_id IS NULL OR OLD.status != 'completed') THEN
    
    -- Створюємо сповіщення про виграш
    INSERT INTO notifications (user_id, type, title, message, link)
    VALUES (
      NEW.winner_id,
      'system',
      '🎉 Вітаємо! Ви виграли в лотереї!',
      'Вітаємо! Ви зірвали джекпот та виграли ' || COALESCE(NEW.winner_prize, NEW.prize_pool)::TEXT || ' бонусних грн в лотереї! Бонуси вже зараховані на ваш рахунок.',
      '/entertainment'
    );
    
    RAISE NOTICE 'Lottery winner notification sent to user %', NEW.winner_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Видаляємо старий тригер якщо він існує
DROP TRIGGER IF EXISTS on_lottery_winner_notify ON lottery_rounds;

-- Створюємо тригер для відправки сповіщення при завершенні раунду з переможцем
CREATE TRIGGER on_lottery_winner_notify
  AFTER UPDATE ON lottery_rounds
  FOR EACH ROW
  WHEN (NEW.status = 'completed' AND NEW.winner_id IS NOT NULL AND 
        (OLD.winner_id IS NULL OR OLD.status != 'completed'))
  EXECUTE FUNCTION notify_lottery_winner();

-- Коментарі
COMMENT ON FUNCTION notify_lottery_winner IS 'Відправляє системне сповіщення користувачу при виграші в лотереї';
COMMENT ON TRIGGER on_lottery_winner_notify ON lottery_rounds IS 'Тригер для автоматичного створення сповіщення при виграші в лотереї';
