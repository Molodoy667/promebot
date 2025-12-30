import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function executeSql(sql) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`
    },
    body: JSON.stringify({ sql_query: sql })
  });
  return await response.text();
}

(async () => {
  console.log('Перевірка та ініціалізація статистики...\n');
  
  // 1. Перевірка таблиці
  console.log('1. Перевірка таблиці bot_global_stats:');
  const check = await executeSql(`
    SELECT EXISTS (
      SELECT FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = 'bot_global_stats'
    );
  `);
  console.log(check);
  
  // 2. Перерахунок статистики
  console.log('\n2. Ініціалізація даних:');
  const init = await executeSql(`
    INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
    SELECT bot_id, users, channels, posts 
    FROM recalculate_bot_global_stats()
    ON CONFLICT (bot_id) 
    DO UPDATE SET
      total_users = EXCLUDED.total_users,
      total_channels = EXCLUDED.total_channels,
      total_posts = EXCLUDED.total_posts
    RETURNING *;
  `);
  console.log(init);
  
  // 3. Показати результат
  console.log('\n3. Поточна статистика:');
  const stats = await executeSql(`
    SELECT 
      tb.bot_name,
      bgs.total_users,
      bgs.total_channels,
      bgs.total_posts
    FROM bot_global_stats bgs
    JOIN telegram_bots tb ON tb.id = bgs.bot_id;
  `);
  console.log(stats);
  
  console.log('\nГотово! Тепер перезавантажте сторінку в браузері.');
})();
