import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://vtrkcgaajgtlkjqcnwxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODU1MzAsImV4cCI6MjA3OTE2MTUzMH0.49zrq4POFrdQ0LV7kx9FrOMCyat4ic21pyzUFkGzVPo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCategories() {
  console.log('🔍 Перевірка категорій...\n');

  // Get all categories
  const { data: categories, error } = await supabase
    .from('category_prompts')
    .select('*')
    .order('category_name');

  if (error) {
    console.error('❌ Помилка завантаження категорій:', error);
    return;
  }

  console.log(`📊 Всього категорій: ${categories.length}\n`);

  const missingKeys = categories.filter(cat => !cat.category_key || cat.category_key.trim() === '');
  const hasKeys = categories.filter(cat => cat.category_key && cat.category_key.trim() !== '');

  console.log(`✅ Категорій з ключами: ${hasKeys.length}`);
  hasKeys.forEach(cat => {
    console.log(`   ${cat.emoji || '📝'} ${cat.category_name} → ${cat.category_key}`);
  });

  console.log(`\n⚠️  Категорій без ключів: ${missingKeys.length}`);
  if (missingKeys.length > 0) {
    missingKeys.forEach(cat => {
      console.log(`   ${cat.emoji || '📝'} ${cat.category_name} (ID: ${cat.id})`);
    });

    console.log('\n🔧 Виправлення категорій...\n');

    for (const cat of missingKeys) {
      // Generate category_key from category_name using Ukrainian to Latin transliteration
      const translitMap = {
        'А': 'A', 'Б': 'B', 'В': 'V', 'Г': 'H', 'Ґ': 'G', 'Д': 'D', 'Е': 'E', 'Є': 'Ye', 'Ж': 'Zh', 'З': 'Z',
        'И': 'Y', 'І': 'I', 'Ї': 'Yi', 'Й': 'Y', 'К': 'K', 'Л': 'L', 'М': 'M', 'Н': 'N', 'О': 'O', 'П': 'P',
        'Р': 'R', 'С': 'S', 'Т': 'T', 'У': 'U', 'Ф': 'F', 'Х': 'Kh', 'Ц': 'Ts', 'Ч': 'Ch', 'Ш': 'Sh', 'Щ': 'Shch',
        'Ь': '', 'Ю': 'Yu', 'Я': 'Ya',
        'а': 'a', 'б': 'b', 'в': 'v', 'г': 'h', 'ґ': 'g', 'д': 'd', 'е': 'e', 'є': 'ye', 'ж': 'zh', 'з': 'z',
        'и': 'y', 'і': 'i', 'ї': 'yi', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o', 'п': 'p',
        'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'kh', 'ц': 'ts', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch',
        'ь': '', 'ю': 'yu', 'я': 'ya'
      };

      let categoryKey = cat.category_name;
      
      // Transliterate Ukrainian/Russian to Latin
      for (const [cyr, lat] of Object.entries(translitMap)) {
        categoryKey = categoryKey.replace(new RegExp(cyr, 'g'), lat);
      }
      
      // Clean up: lowercase, remove special chars, replace spaces with underscore
      categoryKey = categoryKey
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_')
        .replace(/^_+|_+$/g, '');

      const emoji = cat.emoji || '📝';

      const { error: updateError } = await supabase
        .from('category_prompts')
        .update({
          category_key: categoryKey,
          emoji: emoji
        })
        .eq('id', cat.id);

      if (updateError) {
        console.error(`   ❌ Не вдалося оновити "${cat.category_name}":`, updateError.message);
      } else {
        console.log(`   ✅ Оновлено "${cat.category_name}" → "${categoryKey}"`);
      }
    }

    console.log('\n✨ Готово! Всі категорії тепер мають ключі.');
  } else {
    console.log('\n✨ Всі категорії вже мають ключі!');
  }

  // Final check
  console.log('\n📋 Фінальний список категорій:\n');
  const { data: finalCategories } = await supabase
    .from('category_prompts')
    .select('*')
    .order('category_name');

  if (finalCategories) {
    finalCategories.forEach(cat => {
      const status = (cat.category_key && cat.category_key.trim()) ? '✅' : '❌';
      console.log(`   ${status} ${cat.emoji || '📝'} ${cat.category_name} → ${cat.category_key || 'MISSING'}`);
    });
    
    console.log(`\n📊 Підсумок: ${finalCategories.length} категорій, всі з ключами: ${finalCategories.filter(c => c.category_key && c.category_key.trim()).length === finalCategories.length ? '✅' : '❌'}`);
  }
}

fixCategories().catch(console.error);
