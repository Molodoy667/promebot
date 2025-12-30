import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Помилка: Не знайдено SUPABASE_URL або SUPABASE_SERVICE_ROLE_KEY в .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runSQL() {
  try {
    console.log('Читання SQL файлу...\n');
    const sql = readFileSync('APPLY_MANUALLY.sql', 'utf8');
    
    // Розбиваємо на окремі команди
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--') && s !== 'END');

    console.log(`Знайдено ${statements.length} SQL команд\n`);
    
    let success = 0;
    let failed = 0;

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i].trim();
      if (!stmt) continue;

      try {
        // Виконуємо через rpc функцію
        const { data, error } = await supabase.rpc('exec_sql', {
          sql_query: stmt + ';'
        });

        if (error) {
          // Ігноруємо помилки "already exists"
          if (error.message.includes('already exists') || 
              error.message.includes('does not exist')) {
            process.stdout.write('.');
            success++;
          } else {
            process.stdout.write('x');
            failed++;
          }
        } else {
          process.stdout.write('.');
          success++;
        }
      } catch (err) {
        process.stdout.write('x');
        failed++;
      }
    }

    console.log(`\n\nВиконано: ${success} успішно, ${failed} помилок\n`);

    // Перевіряємо результат
    console.log('Перевірка bot_global_stats:');
    const { data: stats, error: statsError } = await supabase
      .from('bot_global_stats')
      .select(`
        bot_id,
        total_users,
        total_channels,
        total_posts,
        telegram_bots(bot_name)
      `);

    if (statsError) {
      console.error('Помилка:', statsError.message);
    } else if (stats && stats.length > 0) {
      console.table(stats.map(s => ({
        'Бот': s.telegram_bots?.bot_name || 'N/A',
        'Користувачів': s.total_users,
        'Каналів': s.total_channels,
        'Постів': s.total_posts
      })));
      console.log('\nГотово! Статистика працює!');
    } else {
      console.log('Таблиця порожня. Виконайте ініціалізацію:');
      console.log('SELECT * FROM recalculate_bot_global_stats();');
    }

  } catch (error) {
    console.error('Критична помилка:', error.message);
  }
}

runSQL();
