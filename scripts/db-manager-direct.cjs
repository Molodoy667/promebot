#!/usr/bin/env node

/**
 * DB Manager Direct - Прямий доступ до БД через Supabase REST API
 * Використання:
 *   node scripts/db-manager-direct.cjs query "SELECT * FROM profiles LIMIT 5"
 *   node scripts/db-manager-direct.cjs tables
 *   node scripts/db-manager-direct.cjs check
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Помилка: Не знайдено SUPABASE_URL або ключі в .env');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Перевірка підключення
async function checkConnection() {
  try {
    const { data, error, count } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    console.log('✅ Підключення до БД успішне');
    console.log(`📊 Записів в profiles: ${count}`);
    return true;
  } catch (err) {
    console.error('❌ Помилка підключення:', err.message);
    return false;
  }
}

// Список таблиць через information_schema (якщо є доступ)
async function listTables() {
  try {
    // Спробуємо через прямий запит
    const tables = [
      'profiles', 'telegram_bots', 'telegram_channels', 'channel_stats',
      'subscriptions', 'tariffs', 'transactions', 'notifications',
      'promo_codes', 'referrals', 'posts', 'ai_bots', 'tasks',
      'task_submissions', 'tickets', 'reviews', 'lottery_participants',
      'miner_storage', 'telegram_spies'
    ];
    
    console.log('📊 Основні таблиці в БД:');
    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        if (!error) {
          console.log(`  - ${table}: ${count} записів`);
        }
      } catch (e) {
        // skip
      }
    }
  } catch (err) {
    console.error('❌ Помилка:', err.message);
  }
}

// Дані з таблиці
async function queryTable(tableName, limit = 10) {
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit);
    
    if (error) throw error;
    
    console.log(`📋 Дані з таблиці "${tableName}" (перші ${limit} записів):`);
    console.table(data);
  } catch (err) {
    console.error('❌ Помилка:', err.message);
  }
}

// Кількість записів
async function countTable(tableName) {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    console.log(`📊 Кількість записів в "${tableName}": ${count}`);
  } catch (err) {
    console.error('❌ Помилка:', err.message);
  }
}

// Статистика по таблиці
async function tableStats(tableName) {
  try {
    const { data, error, count } = await supabase
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) throw error;
    
    console.log(`📊 Статистика таблиці "${tableName}":`);
    console.log(`  Записів: ${count}`);
    if (data && data.length > 0) {
      console.log(`  Колонки: ${Object.keys(data[0]).join(', ')}`);
    }
  } catch (err) {
    console.error('❌ Помилка:', err.message);
  }
}

// Main
async function main() {
  const [,, command, ...args] = process.argv;
  
  if (!command) {
    console.log(`
🔧 DB Manager Direct - Прямий доступ до Supabase БД

Команди:
  check                      - Перевірка підключення
  tables                     - Список таблиць з кількістю записів
  show <table> [limit]       - Показати дані з таблиці
  count <table>              - Кількість записів
  stats <table>              - Статистика таблиці
  
Приклади:
  node scripts/db-manager-direct.cjs check
  node scripts/db-manager-direct.cjs tables
  node scripts/db-manager-direct.cjs show profiles 5
  node scripts/db-manager-direct.cjs count telegram_bots
  node scripts/db-manager-direct.cjs stats subscriptions
    `);
    return;
  }
  
  switch (command) {
    case 'check':
      await checkConnection();
      break;
    case 'tables':
      await listTables();
      break;
    case 'show':
      if (!args[0]) {
        console.error('❌ Вкажіть назву таблиці');
        return;
      }
      await queryTable(args[0], parseInt(args[1]) || 10);
      break;
    case 'count':
      if (!args[0]) {
        console.error('❌ Вкажіть назву таблиці');
        return;
      }
      await countTable(args[0]);
      break;
    case 'stats':
      if (!args[0]) {
        console.error('❌ Вкажіть назву таблиці');
        return;
      }
      await tableStats(args[0]);
      break;
    default:
      console.error(`❌ Невідома команда: ${command}`);
  }
}

main().catch(console.error);
