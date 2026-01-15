-- Тест: перевірка що posts_current_period НЕ зменшується при видаленні каналу

-- 1. Подивитися поточну статистику
SELECT id, email, posts_current_period, channels_used_count 
FROM profiles 
WHERE email = 'your_email@example.com'; -- замінити на свій email

-- 2. Видалити канал (вручну через UI)

-- 3. Перевірити статистику знову
SELECT id, email, posts_current_period, channels_used_count 
FROM profiles 
WHERE email = 'your_email@example.com';

-- posts_current_period має залишитися таким самим!
-- channels_used_count має зменшитися на 1
