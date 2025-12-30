import { readFileSync } from 'fs';
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
  console.log('🔄 Ініціалізація статистики ботів...\n');
  
  // Виконуємо функцію перерахунку
  const sql = `
    INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
    SELECT bot_id, users, channels, posts 
    FROM recalculate_bot_global_stats()
    ON CONFLICT (bot_id) 
    DO UPDATE SET
      total_users = EXCLUDED.total_users,
      total_channels = EXCLUDED.total_channels,
      total_posts = EXCLUDED.total_posts;
  `;
  
  const { ok, result } = await executeSql(sql);
  
  if (ok) {
    console.log('✅ Статистику ініціалізовано!');
    console.log('');
    console.log('📊 Перевірте: SELECT * FROM bot_global_stats;');
  } else {
    console.log('❌ Помилка:', result);
  }
})();
