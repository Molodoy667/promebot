import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run(sql) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ sql_query: sql })
  });
  return await r.text();
}

console.log('Створення правильної функції...\n');

const funcSQL = `
DROP FUNCTION IF EXISTS public.recalculate_bot_global_stats();

CREATE FUNCTION public.recalculate_bot_global_stats()
RETURNS TABLE(bot_id UUID, users INTEGER, channels INTEGER, posts INTEGER) 
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  WITH all_bots AS (
    SELECT tb.id as bot_id FROM public.telegram_bots tb
  )
  SELECT 
    ab.bot_id,
    COALESCE((SELECT COUNT(DISTINCT bs.user_id)::INTEGER FROM public.bot_services bs WHERE bs.bot_id = ab.bot_id), 0) +
    COALESCE((SELECT COUNT(DISTINCT ai.user_id)::INTEGER FROM public.ai_bot_services ai WHERE ai.bot_id = ab.bot_id), 0) as users,
    COALESCE((SELECT COUNT(bs.id)::INTEGER FROM public.bot_services bs WHERE bs.bot_id = ab.bot_id), 0) +
    COALESCE((SELECT COUNT(ai.id)::INTEGER FROM public.ai_bot_services ai WHERE ai.bot_id = ab.bot_id), 0) as channels,
    COALESCE((SELECT COUNT(agp.id)::INTEGER FROM public.ai_bot_services ai JOIN public.ai_generated_posts agp ON agp.ai_bot_service_id = ai.id WHERE ai.bot_id = ab.bot_id AND agp.status = 'published'), 0) as posts
  FROM all_bots ab;
END;
$$;
`;

const result = await run(funcSQL);
console.log('Результат:', result);

console.log('\nІніціалізація...');
const initResult = await run(`
  INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
  SELECT r.bot_id, r.users, r.channels, r.posts 
  FROM public.recalculate_bot_global_stats() AS r
  ON CONFLICT (bot_id) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    total_channels = EXCLUDED.total_channels,
    total_posts = EXCLUDED.total_posts
`);

console.log('Результат:', initResult);

console.log('\nПеревірка:');
const stats = await run('SELECT bot_id, total_users, total_channels, total_posts FROM bot_global_stats');
console.log(stats);

console.log('\n✅ Готово! Перезавантажте сторінку.');
