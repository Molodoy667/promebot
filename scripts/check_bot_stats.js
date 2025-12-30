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
  const result = await response.text();
  return { ok: response.ok, result };
}

(async () => {
  console.log('🔍 Перевірка статистики ботів\n');
  
  // 1. Перевірити bot_global_stats
  console.log('📊 1. Перевірка bot_global_stats:');
  const { result: stats } = await executeSql('SELECT * FROM bot_global_stats;');
  console.log(stats);
  console.log('');
  
  // 2. Перевірити тригери
  console.log('🔧 2. Перевірка тригерів:');
  const { result: triggers } = await executeSql(`
    SELECT trigger_name, event_object_table, action_statement 
    FROM information_schema.triggers 
    WHERE trigger_name LIKE '%bot_stats%' OR trigger_name LIKE '%bot_global%';
  `);
  console.log(triggers);
  console.log('');
  
  // 3. Перерахувати статистику вручну
  console.log('🔄 3. Перерахунок статистики:');
  const { result: recalc } = await executeSql(`
    INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
    SELECT bot_id, users, channels, posts 
    FROM recalculate_bot_global_stats()
    ON CONFLICT (bot_id) 
    DO UPDATE SET
      total_users = EXCLUDED.total_users,
      total_channels = EXCLUDED.total_channels,
      total_posts = EXCLUDED.total_posts;
  `);
  console.log(recalc);
  console.log('');
  
  // 4. Показати результат
  console.log('📊 4. Результат після перерахунку:');
  const { result: finalStats } = await executeSql(`
    SELECT 
      tb.bot_name,
      bgs.total_users,
      bgs.total_channels,
      bgs.total_posts
    FROM bot_global_stats bgs
    JOIN telegram_bots tb ON tb.id = bgs.bot_id;
  `);
  console.log(finalStats);
})();
