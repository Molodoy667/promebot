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
  const text = await response.text();
  return { ok: response.ok, text };
}

(async () => {
  console.log('Створення таблиці bot_global_stats...\n');
  
  const { ok, text } = await executeSql(`
    DROP TABLE IF EXISTS public.bot_global_stats CASCADE;
    
    CREATE TABLE public.bot_global_stats (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      bot_id UUID NOT NULL REFERENCES public.telegram_bots(id) ON DELETE CASCADE,
      total_users INTEGER DEFAULT 0,
      total_channels INTEGER DEFAULT 0,
      total_posts INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(bot_id)
    );
    
    ALTER TABLE public.bot_global_stats ENABLE ROW LEVEL SECURITY;
    
    DROP POLICY IF EXISTS "Allow read for authenticated" ON public.bot_global_stats;
    CREATE POLICY "Allow read for authenticated"
      ON public.bot_global_stats FOR SELECT TO authenticated USING (true);
  `);
  
  console.log('Результат:', ok ? '✅ Успішно' : '❌ Помилка');
  console.log(text);
  
  if (ok) {
    console.log('\n✅ Таблиця створена! Тепер застосуйте APPLY_MANUALLY.sql в Dashboard');
    console.log('https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/sql/new');
  }
})();
