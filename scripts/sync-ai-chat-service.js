import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function syncAIChatService() {
  console.log('🔄 Синхронізація налаштувань AI Chat сервісу...\n');
  
  try {
    // Перевіряємо чи є ai_chat сервіс
    const { data: existingChat, error: checkError } = await supabase
      .from('ai_service_settings')
      .select('*')
      .eq('service_name', 'ai_chat')
      .single();
    
    if (existingChat) {
      console.log('✅ AI Chat сервіс вже існує:');
      console.log(JSON.stringify(existingChat, null, 2));
      return true;
    }
    
    // Якщо немає, перевіряємо чи є активний text_generation сервіс
    const { data: textService, error: textError } = await supabase
      .from('ai_service_settings')
      .select('*')
      .eq('service_name', 'text_generation')
      .eq('is_active', true)
      .single();
    
    if (textService) {
      console.log('📝 Знайдено активний text_generation сервіс, копіюємо налаштування...');
      
      // Створюємо ai_chat сервіс на основі text_generation
      const { data: newChatService, error: createError } = await supabase
        .from('ai_service_settings')
        .insert({
          service_name: 'ai_chat',
          provider: textService.provider || 'OpenAI',
          api_endpoint: textService.api_endpoint,
          api_key: textService.api_key,
          model_name: textService.model_name,
          is_active: true,
          test_status: 'pending'
        })
        .select()
        .single();
      
      if (createError) throw createError;
      
      console.log('✅ AI Chat сервіс створено на основі text_generation:');
      console.log(JSON.stringify(newChatService, null, 2));
      return true;
    }
    
    // Якщо немає жодного сервісу, створюємо порожній
    console.log('📝 Створення порожнього AI Chat сервісу...');
    
    const { data: newService, error: insertError } = await supabase
      .from('ai_service_settings')
      .insert({
        service_name: 'ai_chat',
        provider: 'OpenAI',
        api_endpoint: 'https://api.openai.com/v1/chat/completions',
        api_key: '',
        model_name: 'gpt-3.5-turbo',
        is_active: false,
        test_status: 'pending'
      })
      .select()
      .single();
    
    if (insertError) throw insertError;
    
    console.log('✅ AI Chat сервіс створено (потрібно налаштувати в адмінці):');
    console.log(JSON.stringify(newService, null, 2));
    console.log('\n⚠️  Не забудьте додати API Key та увімкнути сервіс в /admin/ai-services');
    
    return true;
    
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    return false;
  }
}

syncAIChatService()
  .then(success => {
    if (success) {
      console.log('\n🎉 Синхронізація завершена!');
      console.log('Оновіть сторінку в браузері (F5)');
    }
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Критична помилка:', err);
    process.exit(1);
  });
