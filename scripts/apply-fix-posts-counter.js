import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = 'https://vtrkcgaajgtlkjqcnwxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    const sqlPath = join(__dirname, '../supabase/migrations/20260115000000_fix_posts_counter_on_delete.sql');
    const sql = readFileSync(sqlPath, 'utf-8');
    
    console.log('Applying posts counter fix migration...');
    
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql_query: sql 
    });
    
    if (error) {
      console.error('Error:', error);
      process.exit(1);
    }
    
    console.log('✅ Posts counter fix migration applied successfully!');
    console.log('Result:', data);
  } catch (err) {
    console.error('Exception:', err);
    process.exit(1);
  }
}

applyMigration();
