import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function startNewRound() {
  console.log('🎰 Запуск нового раунду лотереї...\n');
  
  try {
    // Завершуємо всі активні раунди
    const { data: activeRounds, error: checkError } = await supabase
      .from('lottery_rounds')
      .select('*')
      .eq('status', 'active');
    
    if (checkError) throw checkError;
    
    if (activeRounds && activeRounds.length > 0) {
      console.log(`⚠️  Знайдено ${activeRounds.length} активних раунд(ів). Завершуємо їх...`);
      
      for (const round of activeRounds) {
        const { error: completeError } = await supabase
          .from('lottery_rounds')
          .update({ 
            status: 'completed',
            end_time: new Date().toISOString()
          })
          .eq('id', round.id);
        
        if (completeError) {
          console.log(`❌ Помилка завершення раунду ${round.id}:`, completeError.message);
        } else {
          console.log(`✅ Раунд ${round.id} завершено`);
        }
      }
    } else {
      console.log('✅ Активних раундів немає');
    }
    
    // Створюємо новий раунд
    console.log('\n📝 Створення нового раунду...');
    
    const { data: newRound, error: createError } = await supabase
      .from('lottery_rounds')
      .insert({
        prize_pool: 0,
        participants_count: 0,
        status: 'active'
      })
      .select()
      .single();
    
    if (createError) throw createError;
    
    console.log('✅ Новий раунд створено:');
    console.log(JSON.stringify(newRound, null, 2));
    
    console.log('\n🎉 Новий раунд лотереї запущено!');
    console.log('Користувачі можуть купувати квитки.\n');
    
    return true;
    
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    return false;
  }
}

startNewRound()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Критична помилка:', err);
    process.exit(1);
  });
