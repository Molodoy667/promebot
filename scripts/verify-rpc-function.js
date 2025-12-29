#!/usr/bin/env node

/**
 * Перевірка RPC функції calculate_bot_uptime
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://vtrkcgaajgtlkjqcnwxk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODU1MzAsImV4cCI6MjA3OTE2MTUzMH0.49zrq4POFrdQ0LV7kx9FrOMCyat4ic21pyzUFkGzVPo';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function verifyFunction() {
  console.log('🔍 Verifying calculate_bot_uptime RPC function...\n');

  try {
    // 1. Отримати список ботів
    console.log('1️⃣ Fetching telegram bots...');
    const { data: bots, error: botsError } = await supabase
      .from('telegram_bots')
      .select('id, bot_name, bot_username')
      .limit(3);

    if (botsError) {
      console.error('❌ Error fetching bots:', botsError.message);
      return;
    }

    if (!bots || bots.length === 0) {
      console.log('⚠️  No bots found in database.');
      return;
    }

    console.log(`✅ Found ${bots.length} bot(s)\n`);

    // 2. Тестувати функцію для кожного бота
    console.log('2️⃣ Testing calculate_bot_uptime for each bot...\n');

    for (const bot of bots) {
      console.log(`Testing bot: ${bot.bot_name} (@${bot.bot_username})`);
      console.log(`Bot ID: ${bot.id}`);

      const { data, error } = await supabase.rpc('calculate_bot_uptime', {
        bot_id: bot.id
      });

      if (error) {
        console.error(`❌ Error:`, error);
        console.error(`   Code: ${error.code}`);
        console.error(`   Message: ${error.message}`);
        console.error(`   Details: ${error.details}`);
        console.error(`   Hint: ${error.hint}\n`);
      } else {
        console.log(`✅ Success! Uptime: ${data}%\n`);
      }
    }

    // 3. Тест з неіснуючим bot_id
    console.log('3️⃣ Testing with non-existent bot_id...');
    const fakeUuid = '00000000-0000-0000-0000-000000000000';
    
    const { data: fakeData, error: fakeError } = await supabase.rpc('calculate_bot_uptime', {
      bot_id: fakeUuid
    });

    if (fakeError) {
      console.error('❌ Error with fake UUID:', fakeError.message);
    } else {
      console.log(`✅ Returned: ${fakeData}% (should be 0 for non-existent bot)\n`);
    }

    // 4. Перевірка прав доступу
    console.log('4️⃣ Checking function permissions...');
    console.log('Current role: anon (unauthenticated)');
    console.log('Expected: Function should be accessible to anon role\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

verifyFunction();
