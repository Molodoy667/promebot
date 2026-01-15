import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vtrkcgaajgtlkjqcnwxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzU4NTUzMCwiZXhwIjoyMDc5MTYxNTMwfQ.TD_KPHHbIMgZV2K3CGpaOTdAKOqPeFdpXz8UENOod8c';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTriggers() {
  const { data, error } = await supabase.rpc('exec_sql', {
    sql_query: `
      SELECT 
        proname as function_name,
        pg_get_functiondef(oid) as definition
      FROM pg_proc
      WHERE proname IN ('cleanup_ai_bot_service_stats', 'cleanup_bot_service_stats', 'trigger_update_stats_bot_services', 'trigger_update_stats_ai_bot_services');
    `
  });

  if (error) {
    console.error('Error:', error);
    process.exit(1);
  }

  console.log('Current trigger functions:');
  console.log('Data type:', typeof data, 'Data:', data);
  
  if (Array.isArray(data)) {
    data.forEach(row => {
      console.log('\n=== Function:', row.function_name, '===');
      console.log(row.definition);
    });
  } else {
    console.log('Data is not an array:', data);
  }
  
  process.exit(0);
}

checkTriggers();
