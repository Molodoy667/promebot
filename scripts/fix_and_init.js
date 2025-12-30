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
  console.log('Виправлення функції...\n');
  
  // Створюємо правильну функцію
  const funcResult = await executeSql(`
    CREATE OR REPLACE FUNCTION public.recalculate_bot_global_stats()
    RETURNS TABLE(bot_id UUID, users INTEGER, channels INTEGER, posts INTEGER) 
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      WITH plagiarist_bots AS (
        SELECT 
          bs.bot_id,
          COUNT(DISTINCT bs.user_id)::INTEGER as users,
          COUNT(bs.id)::INTEGER as channels,
          0::INTEGER as posts
        FROM public.bot_services bs
        GROUP BY bs.bot_id
      ),
      ai_bots AS (
        SELECT 
          ai.bot_id,
          COUNT(DISTINCT ai.user_id)::INTEGER as users,
          COUNT(ai.id)::INTEGER as channels
        FROM public.ai_bot_services ai
        GROUP BY ai.bot_id
      ),
      ai_posts AS (
        SELECT 
          ai.bot_id,
          COUNT(agp.id)::INTEGER as posts
        FROM public.ai_bot_services ai
        LEFT JOIN public.ai_generated_posts agp ON agp.ai_bot_service_id = ai.id AND agp.status = 'published'
        GROUP BY ai.bot_id
      ),
      combined AS (
        SELECT bot_id, users, channels, posts FROM plagiarist_bots
        UNION ALL
        SELECT ai.bot_id, ai.users, ai.channels, COALESCE(ap.posts, 0) as posts
        FROM ai_bots ai
        LEFT JOIN ai_posts ap ON ap.bot_id = ai.bot_id
      )
      SELECT 
        c.bot_id,
        SUM(c.users)::INTEGER as users,
        SUM(c.channels)::INTEGER as channels,
        SUM(c.posts)::INTEGER as posts
      FROM combined c
      GROUP BY c.bot_id;
    END;
    $$;
  `);
  
  console.log('Функція:', funcResult);
  
  // Ініціалізуємо дані
  console.log('\nІніціалізація даних...');
  const initResult = await executeSql(`
    INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
    SELECT bot_id, users, channels, posts 
    FROM public.recalculate_bot_global_stats()
    ON CONFLICT (bot_id) 
    DO UPDATE SET
      total_users = EXCLUDED.total_users,
      total_channels = EXCLUDED.total_channels,
      total_posts = EXCLUDED.total_posts;
  `);
  
  console.log('Ініціалізація:', initResult);
  
  // Перевірка
  console.log('\nПеревірка:');
  const stats = await executeSql(`
    SELECT bot_id, total_users, total_channels, total_posts 
    FROM bot_global_stats;
  `);
  console.log(stats);
  
  console.log('\n✅ Готово! Перезавантажте сторінку.');
})();
