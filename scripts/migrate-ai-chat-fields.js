import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'vtrkcgaajgtlkjqcnwxk';

async function migrate() {
  console.log('🔄 Міграція налаштувань AI чату...\n');
  
  const sqlFile = path.join(__dirname, '..', 'supabase/migrations/20251214230000_add_ai_chat_fields_to_tools.sql');
  const sql = fs.readFileSync(sqlFile, 'utf8');
  
  try {
    const response = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        query: sql
      })
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('✅ Міграція успішна!\n');
      return true;
    } else {
      console.log('❌ Помилка:', JSON.stringify(result, null, 2));
      return false;
    }
  } catch (error) {
    console.error('❌ Помилка:', error.message);
    return false;
  }
}

migrate()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('❌ Критична помилка:', error);
    process.exit(1);
  });
