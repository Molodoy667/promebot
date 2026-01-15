-- Перевірка чи тригери викликають update_user_stats при DELETE

SELECT 
  p.proname as function_name,
  pg_get_functiondef(p.oid) as definition
FROM pg_proc p
WHERE p.proname IN (
  'trigger_update_stats_bot_services',
  'trigger_update_stats_ai_bot_services'
)
ORDER BY p.proname;
