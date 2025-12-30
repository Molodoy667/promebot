#!/usr/bin/env node

/**
 * DB Manager - Скрипт для роботи з Supabase БД
 * Використання:
 *   node scripts/db-manager.js query "SELECT * FROM profiles LIMIT 5"
 *   node scripts/db-manager.js tables
 *   node scripts/db-manager.js check
 *   node scripts/db-manager.js exec path/to/file.sql
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
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
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    if (error) throw error;
    console.log('✅ Підключення до БД успішне');
    return true;
  } catch (err) {
    console.error('❌ Помилка підключення:', err.message);
    return false;
  }
}

// Виконати SQL запит
async function executeQuery(query) {
  try {
    console.log('🔄 Виконую запит...\n');
    const { data, error } = await supabase.rpc('exec_sql', { query_text: query });
    
    if (error) {
      console.error('❌ Помилка:', error.message);
      return;
    }
    
    console.log('✅ Результат:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('❌ Помилка:', err.message);
  }
}

// Список таблиць
async function listTables() {
  const query = `
    SELECT 
      table_name,
      (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns_count
    FROM information_schema.tables t
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query_text: query });
    if (error) throw error;
    
    console.log('📊 Таблиці в БД:');
    console.table(data);
  } catch (err) {
    console.error('❌ Помилка:', err.message);
  }
}

// Виконати SQL з файлу
async function executeFile(filePath) {
  try {
    const fullPath = path.resolve(process.cwd(), filePath);
    if (!fs.existsSync(fullPath)) {
      console.error(`❌ Файл не знайдено: ${fullPath}`);
      return;
    }
    
    const sql = fs.readFileSync(fullPath, 'utf8');
    console.log(`📄 Виконую SQL з файлу: ${filePath}\n`);
    await executeQuery(sql);
  } catch (err) {
    console.error('❌ Помилка:', err.message);
  }
}

// Інфо про таблицю
async function tableInfo(tableName) {
  const query = `
    SELECT 
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_name = '${tableName}'
    ORDER BY ordinal_position;
  `;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { query_text: query });
    if (error) throw error;
    
    console.log(`📋 Структура таблиці "${tableName}":`);
    console.table(data);
  } catch (err) {
    console.error('❌ Помилка:', err.message);
  }
}

// Main
async function main() {
  const [,, command, ...args] = process.argv;
  
  if (!command) {
    console.log(`
🔧 DB Manager - Інструмент для роботи з Supabase БД

Команди:
  check                    - Перевірка підключення
  tables                   - Список всіх таблиць
  info <table_name>        - Інфо про таблицю
  query "<SQL>"            - Виконати SQL запит
  exec <file.sql>          - Виконати SQL з файлу
  
Приклади:
  node scripts/db-manager.js check
  node scripts/db-manager.js tables
  node scripts/db-manager.js info profiles
  node scripts/db-manager.js query "SELECT * FROM profiles LIMIT 5"
  node scripts/db-manager.js exec migrations/fix.sql
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
    case 'info':
      if (!args[0]) {
        console.error('❌ Вкажіть назву таблиці');
        return;
      }
      await tableInfo(args[0]);
      break;
    case 'query':
      if (!args[0]) {
        console.error('❌ Вкажіть SQL запит');
        return;
      }
      await executeQuery(args.join(' '));
      break;
    case 'exec':
      if (!args[0]) {
        console.error('❌ Вкажіть шлях до SQL файлу');
        return;
      }
      await executeFile(args[0]);
      break;
    default:
      console.error(`❌ Невідома команда: ${command}`);
  }
}

main().catch(console.error);
