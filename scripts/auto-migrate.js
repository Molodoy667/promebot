import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Завантажуємо .env
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Не знайдено VITE_SUPABASE_URL або VITE_SUPABASE_ANON_KEY в .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function applyMigrationDirectly() {
  console.log('🔄 Застосування міграції AI чату через прямі SQL запити...\n');
  
  try {
    // 1. Створюємо таблицю ai_chat_settings
    console.log('📝 Створення таблиці ai_chat_settings...');
    const { error: error1 } = await supabase.rpc('exec_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS ai_chat_settings (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          rental_price DECIMAL(10,2) NOT NULL DEFAULT 10.00,
          rental_duration_minutes INTEGER NOT NULL DEFAULT 60,
          free_duration_minutes INTEGER NOT NULL DEFAULT 10,
          free_cooldown_hours INTEGER NOT NULL DEFAULT 6,
          is_enabled BOOLEAN NOT NULL DEFAULT true,
          created_at TIMESTAMPTZ DEFAULT now(),
          updated_at TIMESTAMPTZ DEFAULT now()
        );
      `
    });
    
    if (error1 && !error1.message.includes('already exists')) {
      console.log('⚠️  Використовую альтернативний метод (exec_sql недоступний)');
      console.log('📋 Потрібно виконати SQL вручну через Supabase Dashboard');
      console.log('👉 https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/sql\n');
      
      // Показуємо SQL для ручного виконання
      const sqlFile = path.join(__dirname, '..', 'apply_ai_chat_migration.sql');
      const sql = fs.readFileSync(sqlFile, 'utf8');
      console.log('Скопіюйте цей SQL:\n');
      console.log('=' .repeat(80));
      console.log(sql);
      console.log('=' .repeat(80));
      return false;
    }
    
    console.log('✅ Таблиця створена');
    
    // 2. Перевіряємо чи таблиця існує
    console.log('\n🔍 Перевірка таблиці...');
    const { data, error: checkError } = await supabase
      .from('ai_chat_settings')
      .select('count')
      .limit(1);
    
    if (checkError) {
      console.log('❌ Таблиця не знайдена:', checkError.message);
      return false;
    }
    
    console.log('✅ Таблиця існує!');
    
    // 3. Додаємо початкові дані якщо потрібно
    console.log('\n📝 Перевірка початкових даних...');
    const { data: existing } = await supabase
      .from('ai_chat_settings')
      .select('*')
      .limit(1);
    
    if (!existing || existing.length === 0) {
      console.log('📝 Додавання початкових налаштувань...');
      const { error: insertError } = await supabase
        .from('ai_chat_settings')
        .insert({
          rental_price: 10.00,
          rental_duration_minutes: 60,
          free_duration_minutes: 10,
          free_cooldown_hours: 6,
          is_enabled: true
        });
      
      if (insertError) {
        console.log('⚠️  Помилка додавання даних:', insertError.message);
      } else {
        console.log('✅ Початкові дані додано');
      }
    } else {
      console.log('✅ Початкові дані вже існують');
    }
    
    console.log('\n🎉 Міграція успішно застосована!');
    console.log('Оновіть сторінку в браузері (F5)\n');
    return true;
    
  } catch (error) {
    console.error('❌ Критична помилка:', error.message);
    return false;
  }
}

// Виконуємо міграцію
applyMigrationDirectly()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Помилка:', error);
    process.exit(1);
  });
