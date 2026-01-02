-- Знайти DATABASE TRIGGERS які викликають HTTP POST
SELECT 
  trigger_schema,
  trigger_name,
  event_object_table,
  event_manipulation,
  action_statement,
  action_timing
FROM information_schema.triggers
WHERE action_statement LIKE '%http_post%'
   OR action_statement LIKE '%net.http%'
ORDER BY trigger_name;
