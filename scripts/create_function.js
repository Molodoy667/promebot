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
  console.log('Створення функції recalculate_bot_global_stats...\n');
  
  const result = await executeSql(`
    CREATE OR REPLACE FUNCTION public.recalculate_bot_global_stats()
    RETURNS TABLE(bot_id UUID, users INTEGER, channels INTEGER, posts INTEGER) 
    LANGUAGE plpgsql
    AS $$
    BEGIN
      RETURN QUERY
      SELECT 
        COALESCE(bs.bot_id, ai.bot_id) as bot_id,
        (COUNT(DISTINCT bs.user_id) + COUNT(DISTINCT ai.user_id))::INTEGER as users,
        (COUNT(bs.id) + COUNT(ai.id))::INTEGER as channels,
        COALESCE((
          SELECT COUNT(*)::INTEGER 
          FROM public.ai_generated_posts agp 
          WHERE agp.ai_bot_service_id = ai.id 
          AND agp.status = 'published'
        ), 0) as posts
      FROM public.bot_services bs
      FULL OUTER JOIN public.ai_bot_services ai ON bs.bot_id = ai.bot_id
      GROUP BY COALESCE(bs.bot_id, ai.bot_id);
    END;
    $$;
  `);
  
  console.log('Результат:', result);
  
  // Тепер ініціалізуємо дані
  console.log('\nІніціалізація даних...');
  const init = await executeSql(`
    INSERT INTO public.bot_global_stats (bot_id, total_users, total_channels, total_posts)
    SELECT bot_id, users, channels, posts 
    FROM public.recalculate_bot_global_stats()
    ON CONFLICT (bot_id) 
    DO UPDATE SET
      total_users = EXCLUDED.total_users,
      total_channels = EXCLUDED.total_channels,
      total_posts = EXCLUDED.total_posts;
  `);
  
  console.log('Результат:', init);
  
  // Перевірка
  console.log('\nПеревірка статистики:');
  const stats = await executeSql(`
    SELECT bot_id, total_users, total_channels, total_posts 
    FROM bot_global_stats;
  `);
  console.log(stats);
  
  console.log('\n✅ Готово! Перезавантажте сторінку.');
})();
