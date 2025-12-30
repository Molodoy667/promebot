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

console.log('Ініціалізація...');
const result = await run(`
  INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
  SELECT r.bot_id, r.users, r.channels, r.posts 
  FROM public.recalculate_bot_global_stats() AS r
  ON CONFLICT (bot_id) DO UPDATE SET
    total_users = EXCLUDED.total_users,
    total_channels = EXCLUDED.total_channels,
    total_posts = EXCLUDED.total_posts
`);

console.log(result);

console.log('\nПеревірка:');
const stats = await run('SELECT bot_id, total_users, total_channels, total_posts FROM bot_global_stats');
console.log(stats);

console.log('\n✅ Готово! Перезавантажте сторінку.');
