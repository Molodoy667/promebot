import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = 'https://vtrkcgaajgtlkjqcnwxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODU1MzAsImV4cCI6MjA3OTE2MTUzMH0.49zrq4POFrdQ0LV7kx9FrOMCyat4ic21pyzUFkGzVPo';

const supabase = createClient(supabaseUrl, supabaseKey);

const sql = fs.readFileSync('FIX_RLS_ONLY.sql', 'utf8');

// Split by semicolons but keep multi-line statements together
const statements = sql
  .split(';')
  .map(s => s.trim())
  .filter(s => s && !s.startsWith('--') && !s.match(/^={3,}/));

console.log(`Виконую ${statements.length} SQL команд...\n`);

for (const stmt of statements) {
  if (!stmt) continue;
  
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: stmt });
    
    if (error) {
      console.error('❌ Помилка:', error.message);
    } else {
      console.log('✅ Виконано:', stmt.substring(0, 60) + '...');
      if (data) console.log('   Результат:', data);
    }
  } catch (e) {
    console.error('❌ Виключення:', e.message);
  }
}

console.log('\n✨ Готово!');
