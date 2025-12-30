import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('❌ Не знайдено SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY в .env');
  process.exit(1);
}

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

async function applyMigration(filePath) {
  console.log(`\n📄 ${filePath}`);
  const sql = readFileSync(filePath, 'utf8');
  
  console.log('🔄 Виконую...');
  const { ok, result } = await executeSql(sql);
  
  if (ok) {
    console.log('✅ Успішно!');
    return true;
  } else {
    console.log('❌ Помилка:', result);
    return false;
  }
}

(async () => {
  console.log('🚀 Застосування міграцій bot_global_stats\n');
  
  // Спочатку створюємо функцію exec_sql
  console.log('📌 Крок 1: Створення функції exec_sql');
  const step1 = await applyMigration('supabase/migrations/20251230000002_add_exec_sql_function.sql');
  
  if (!step1) {
    console.log('\n⚠️ Не вдалося створити exec_sql. Продовжую...');
  }
  
  // Тепер застосовуємо основні міграції
  console.log('\n📌 Крок 2: Створення bot_global_stats');
  const step2 = await applyMigration('supabase/migrations/20251230000000_add_bot_global_stats.sql');
  
  console.log('\n📌 Крок 3: Додавання тригерів для постів');
  const step3 = await applyMigration('supabase/migrations/20251230000001_add_post_count_triggers.sql');
  
  console.log('\n📌 Крок 4: Синхронізація з telegram_bots');
  const step4 = await applyMigration('supabase/migrations/20251230000003_sync_bot_stats_to_telegram_bots.sql');
  
  console.log('\n' + '='.repeat(60));
  
  if (step2 && step3 && step4) {
    console.log('🎉 Всі міграції застосовано успішно!');
    console.log('\n📊 Перевірте:');
    console.log('  SELECT * FROM bot_global_stats;');
    console.log('  SELECT id, bot_name, users_count, channels_count, posts_count FROM telegram_bots;');
  } else {
    console.log('⚠️ Деякі міграції не застосовано');
    console.log('💡 Виконайте вручну через:');
    console.log('https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/sql/new');
  }
})();
