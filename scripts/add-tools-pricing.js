import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const projectRef = 'vtrkcgaajgtlkjqcnwxk';

async function addToolsPricing() {
  console.log('🔄 Додавання ціноутворення та VIP знижки...\n');
  
  const sqlFile = path.join(__dirname, '..', 'supabase/migrations/20251214220000_add_tools_pricing_settings.sql');
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
      console.log('✅ Колонки додано!');
      console.log('\nДодані поля:');
      console.log('- price (ціна в бонусних ₴)');
      console.log('- vip_discount_enabled (увімк/вимк VIP знижку)');
      console.log('- vip_discount_percent (% знижки, за замовчуванням 50%)\n');
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

addToolsPricing()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('❌ Критична помилка:', error);
    process.exit(1);
  });
