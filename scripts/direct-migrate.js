import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey || serviceRoleKey === 'ВСТАВТЕ_ВАШ_SERVICE_ROLE_KEY_СЮДИ') {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY не налаштований в .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTablesManually() {
  console.log('🔄 Створення таблиць AI чату...\n');
  
  try {
    // Створюємо таблиці по черзі використовуючи Supabase Admin API
    
    // 1. ai_chat_settings
    console.log('📝 Створення ai_chat_settings...');
    const { error: e1 } = await supabase.from('ai_chat_settings').select('id').limit(1);
    
    if (e1 && e1.code === 'PGRST116') {
      console.log('⚠️  Таблиця ai_chat_settings не існує, потрібно створити вручну');
      console.log('\n📋 ВИКОНАЙТЕ SQL ВРУЧНУ:');
      console.log('👉 https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/sql\n');
      
      const sqlFile = path.join(__dirname, '..', 'apply_ai_chat_migration.sql');
      const sql = fs.readFileSync(sqlFile, 'utf8');
      
      // Зберігаємо в буфер обміну (якщо можливо)
      console.log('SQL готовий для копіювання (прокрутіть вниз):');
      console.log('='.repeat(80));
      console.log(sql);
      console.log('='.repeat(80));
      return false;
    }
    
    console.log('✅ Таблиця ai_chat_settings існує');
    
    // Перевіряємо чи є дані
    const { data: settings, error: e2 } = await supabase
      .from('ai_chat_settings')
      .select('*')
      .limit(1);
    
    if (settings && settings.length === 0) {
      console.log('📝 Додавання початкових даних...');
      const { error: insertErr } = await supabase
        .from('ai_chat_settings')
        .insert({
          rental_price: 10.00,
          rental_duration_minutes: 60,
          free_duration_minutes: 10,
          free_cooldown_hours: 6,
          is_enabled: true
        });
      
      if (insertErr) {
        console.log('❌ Помилка:', insertErr.message);
      } else {
        console.log('✅ Дані додано');
      }
    } else {
      console.log('✅ Дані вже існують');
    }
    
    console.log('\n🎉 Перевірка завершена!');
    return true;
    
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    return false;
  }
}

createTablesManually()
  .then(success => {
    if (success) {
      console.log('\n✅ Все готово! Оновіть сторінку (F5)');
    } else {
      console.log('\n⚠️  Потрібно виконати SQL вручну');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Критична помилка:', err);
    process.exit(1);
  });
