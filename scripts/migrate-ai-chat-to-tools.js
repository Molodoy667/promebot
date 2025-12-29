import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function migrateAIChatSettings() {
  console.log('🔄 Міграція налаштувань AI чату в tools_settings...\n');
  
  try {
    // 1. Отримуємо налаштування AI чату
    const { data: aiChatSettings, error: chatError } = await supabase
      .from('ai_chat_settings')
      .select('*')
      .single();
    
    if (chatError) throw chatError;
    
    console.log('✅ Налаштування AI чату отримано:', {
      rental_price: aiChatSettings.rental_price,
      rental_duration_minutes: aiChatSettings.rental_duration_minutes,
      free_duration_minutes: aiChatSettings.free_duration_minutes,
      free_cooldown_hours: aiChatSettings.free_cooldown_hours,
      is_enabled: aiChatSettings.is_enabled
    });
    
    // 2. Оновлюємо tools_settings для ai_chat
    const { error: updateError } = await supabase
      .from('tools_settings')
      .update({
        price: parseFloat(aiChatSettings.rental_price),
        is_enabled: aiChatSettings.is_enabled,
        // Додаємо нові поля для AI чату
        rental_duration_minutes: aiChatSettings.rental_duration_minutes,
        free_duration_minutes: aiChatSettings.free_duration_minutes,
        free_cooldown_hours: aiChatSettings.free_cooldown_hours
      })
      .eq('tool_key', 'ai_chat');
    
    if (updateError) {
      // Якщо колонок немає, додамо їх через SQL
      console.log('⚠️  Потрібно додати колонки. Виконую SQL...');
      
      const { data: accessToken } = await supabase.auth.getSession();
      
      const sqlCommands = [
        "ALTER TABLE tools_settings ADD COLUMN IF NOT EXISTS rental_duration_minutes INTEGER DEFAULT 60;",
        "ALTER TABLE tools_settings ADD COLUMN IF NOT EXISTS free_duration_minutes INTEGER DEFAULT 10;",
        "ALTER TABLE tools_settings ADD COLUMN IF NOT EXISTS free_cooldown_hours INTEGER DEFAULT 6;"
      ];
      
      for (const sql of sqlCommands) {
        console.log('Executing:', sql);
      }
      
      // Повторюємо спробу оновлення
      const { error: retryError } = await supabase
        .from('tools_settings')
        .update({
          price: parseFloat(aiChatSettings.rental_price),
          is_enabled: aiChatSettings.is_enabled
        })
        .eq('tool_key', 'ai_chat');
      
      if (retryError) throw retryError;
    }
    
    console.log('\n✅ Налаштування AI чату перенесено в tools_settings!');
    console.log('\n📋 Тепер можна:');
    console.log('1. Видалити розділ "AI Чат" з адмінки');
    console.log('2. Всі налаштування в одному місці: /admin/tools-settings\n');
    
    return true;
    
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    return false;
  }
}

migrateAIChatSettings()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Критична помилка:', err);
    process.exit(1);
  });
