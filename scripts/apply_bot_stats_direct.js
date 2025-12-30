import pg from 'pg';
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

// Формуємо connection string
const connectionString = process.env.DATABASE_URL || 
  `postgresql://postgres.${process.env.SUPABASE_PROJECT_REF}:${process.env.SUPABASE_DB_PASSWORD}@aws-0-eu-central-1.pooler.supabase.com:6543/postgres`;

async function runMigrations() {
  const client = new Client({ connectionString });
  
  try {
    console.log('🔌 Підключення до БД...');
    await client.connect();
    console.log('✅ Підключено!\n');

    // Читаємо SQL файл
    console.log('📄 Читання APPLY_MANUALLY.sql...');
    const sql = readFileSync('APPLY_MANUALLY.sql', 'utf8');
    
    console.log('🔄 Виконання SQL...\n');
    await client.query(sql);
    
    console.log('✅ SQL виконано успішно!\n');
    
    // Перевіряємо результат
    console.log('📊 Перевірка bot_global_stats:');
    const result = await client.query(`
      SELECT 
        tb.bot_name,
        bgs.total_users,
        bgs.total_channels,
        bgs.total_posts
      FROM bot_global_stats bgs
      JOIN telegram_bots tb ON tb.id = bgs.bot_id;
    `);
    
    console.table(result.rows);
    
    console.log('\n🎉 Готово! Статистика ботів налаштована!');
    
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    console.error('\n💡 Перевірте:');
    console.error('1. DATABASE_URL в .env');
    console.error('2. Або SUPABASE_PROJECT_REF + SUPABASE_DB_PASSWORD');
  } finally {
    await client.end();
  }
}

runMigrations();
