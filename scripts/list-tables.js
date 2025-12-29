import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listTables() {
  console.log('🔍 Отримання списку таблиць з Supabase...\n');
  
  // Список таблиць які повинні існувати
  const expectedTables = [
    'profiles',
    'app_settings',
    'ai_service_settings',
    'ai_chat_settings',
    'ai_chat_sessions',
    'ai_chat_messages',
    'tariffs',
    'tasks',
    'lottery_settings',
    'user_tariffs'
  ];
  
  console.log('Перевірка таблиць:\n');
  
  for (const table of expectedTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.code === 'PGRST116' || error.message.includes('not find')) {
          console.log(`❌ ${table.padEnd(30)} - НЕ ІСНУЄ`);
        } else {
          console.log(`⚠️  ${table.padEnd(30)} - ПОМИЛКА: ${error.message}`);
        }
      } else {
        const count = data ? data.length : 0;
        console.log(`✅ ${table.padEnd(30)} - існує (рядків: ${count >= 1 ? '1+' : '0'})`);
      }
    } catch (err) {
      console.log(`⚠️  ${table.padEnd(30)} - ПОМИЛКА: ${err.message}`);
    }
  }
  
  console.log('\n' + '='.repeat(60));
}

listTables()
  .then(() => {
    console.log('\n✅ Перевірка завершена');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Помилка:', err.message);
    process.exit(1);
  });
