-- Перевірка кількості записів у всіх таблицях
-- Виконай цей SQL в Supabase Dashboard -> SQL Editor

SELECT 'profiles' as table_name, COUNT(*) as count FROM profiles
UNION ALL
SELECT 'subscriptions', COUNT(*) FROM subscriptions
UNION ALL
SELECT 'transactions', COUNT(*) FROM transactions
UNION ALL
SELECT 'telegram_bots', COUNT(*) FROM telegram_bots
UNION ALL
SELECT 'telegram_channels', COUNT(*) FROM telegram_channels
UNION ALL
SELECT 'channel_stats', COUNT(*) FROM channel_stats
UNION ALL
SELECT 'posts', COUNT(*) FROM posts
UNION ALL
SELECT 'ai_bots', COUNT(*) FROM ai_bots
UNION ALL
SELECT 'tasks', COUNT(*) FROM tasks
UNION ALL
SELECT 'notifications', COUNT(*) FROM notifications
ORDER BY table_name;
