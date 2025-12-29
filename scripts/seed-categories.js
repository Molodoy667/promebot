import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vtrkcgaajgtlkjqcnwxk.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0cmtjZ2Fhamd0bGtqcWNud3hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1ODU1MzAsImV4cCI6MjA3OTE2MTUzMH0.49zrq4POFrdQ0LV7kx9FrOMCyat4ic21pyzUFkGzVPo';

const supabase = createClient(supabaseUrl, supabaseKey);

const defaultCategories = [
  {
    category_name: 'Новини',
    category_key: 'news',
    emoji: '🗞️',
    custom_prompt: 'Створи цікавий новинний пост. Пост має бути інформативним, актуальним та залучаючим для читачів.',
    use_custom_prompt: false
  },
  {
    category_name: 'Технології',
    category_key: 'technology',
    emoji: '💻',
    custom_prompt: 'Створи пост про технології. Розкажи про нові технології, гаджети або IT тренди.',
    use_custom_prompt: false
  },
  {
    category_name: 'Спорт',
    category_key: 'sport',
    emoji: '⚽',
    custom_prompt: 'Створи спортивний пост. Розкажи про спортивні події, новини або досягнення.',
    use_custom_prompt: false
  },
  {
    category_name: 'Наука',
    category_key: 'science',
    emoji: '🔬',
    custom_prompt: 'Створи пост про наукові відкриття або цікаві факти з науки.',
    use_custom_prompt: false
  },
  {
    category_name: 'Подорожі',
    category_key: 'travel',
    emoji: '✈️',
    custom_prompt: 'Створи пост про подорожі, цікаві місця або туристичні поради.',
    use_custom_prompt: false
  },
  {
    category_name: 'Їжа та кулінарія',
    category_key: 'food',
    emoji: '🍽️',
    custom_prompt: 'Створи пост про їжу, рецепти або кулінарні поради.',
    use_custom_prompt: false
  },
  {
    category_name: 'Мода та стиль',
    category_key: 'fashion',
    emoji: '👗',
    custom_prompt: 'Створи пост про моду, стиль або тренди в одязі.',
    use_custom_prompt: false
  },
  {
    category_name: 'Здоров\'я та фітнес',
    category_key: 'fitness',
    emoji: '💪',
    custom_prompt: 'Створи пост про здоров\'я, фітнес або здоровий спосіб життя.',
    use_custom_prompt: false
  },
  {
    category_name: 'Бізнес та фінанси',
    category_key: 'business',
    emoji: '💼',
    custom_prompt: 'Створи пост про бізнес, фінанси або підприємництво.',
    use_custom_prompt: false
  },
  {
    category_name: 'Освіта',
    category_key: 'education',
    emoji: '📚',
    custom_prompt: 'Створи освітній пост. Поділися корисними знаннями або навчальними матеріалами.',
    use_custom_prompt: false
  },
  {
    category_name: 'Розваги',
    category_key: 'entertainment',
    emoji: '🎬',
    custom_prompt: 'Створи пост про розваги, фільми, серіали або шоу-бізнес.',
    use_custom_prompt: false
  },
  {
    category_name: 'Музика',
    category_key: 'music',
    emoji: '🎵',
    custom_prompt: 'Створи пост про музику, артистів або музичні новини.',
    use_custom_prompt: false
  },
  {
    category_name: 'Ігри',
    category_key: 'gaming',
    emoji: '🎮',
    custom_prompt: 'Створи пост про відеоігри, ігрову індустрію або eSports.',
    use_custom_prompt: false
  },
  {
    category_name: 'Мистецтво',
    category_key: 'art',
    emoji: '🎨',
    custom_prompt: 'Створи пост про мистецтво, художників або творчість.',
    use_custom_prompt: false
  },
  {
    category_name: 'Психологія',
    category_key: 'psychology',
    emoji: '🧠',
    custom_prompt: 'Створи пост про психологію, саморозвиток або ментальне здоров\'я.',
    use_custom_prompt: false
  },
  {
    category_name: 'Мотивація',
    category_key: 'motivation',
    emoji: '🎯',
    custom_prompt: 'Створи мотиваційний пост. Надихни читачів на досягнення цілей.',
    use_custom_prompt: false
  },
  {
    category_name: 'Криптовалюта',
    category_key: 'crypto',
    emoji: '₿',
    custom_prompt: 'Створи пост про криптовалюту, блокчейн або цифрові активи.',
    use_custom_prompt: false
  },
  {
    category_name: 'Стиль життя',
    category_key: 'lifestyle',
    emoji: '✨',
    custom_prompt: 'Створи пост про стиль життя, щоденні поради або життєві лайфхаки.',
    use_custom_prompt: false
  },
  {
    category_name: 'Автомобілі',
    category_key: 'automotive',
    emoji: '🚗',
    custom_prompt: 'Створи пост про автомобілі, автоновини або автоспорт.',
    use_custom_permit: false
  },
  {
    category_name: 'Природа та екологія',
    category_key: 'nature',
    emoji: '🌿',
    custom_prompt: 'Створи пост про природу, екологію або захист довкілля.',
    use_custom_prompt: false
  }
];

async function seedCategories() {
  console.log('🌱 Створення початкових категорій...\n');

  // Check if categories already exist
  const { data: existing, error: checkError } = await supabase
    .from('category_prompts')
    .select('id')
    .limit(1);

  if (checkError) {
    console.error('❌ Помилка перевірки:', checkError.message);
    return;
  }

  if (existing && existing.length > 0) {
    console.log('⚠️  Категорії вже існують в базі даних.');
    console.log('Запустіть scripts/check-database.js для перегляду.');
    return;
  }

  console.log(`📦 Додавання ${defaultCategories.length} категорій...\n`);

  for (const category of defaultCategories) {
    const { data, error } = await supabase
      .from('category_prompts')
      .insert(category)
      .select();

    if (error) {
      console.error(`❌ Помилка створення "${category.category_name}":`, error.message);
    } else {
      console.log(`✅ ${category.emoji} ${category.category_name} → ${category.category_key}`);
    }
  }

  console.log('\n✨ Готово! Перевіряємо результат...\n');

  // Verify
  const { data: final, error: finalError } = await supabase
    .from('category_prompts')
    .select('*')
    .order('category_name');

  if (!finalError && final) {
    console.log(`📊 Всього створено категорій: ${final.length}\n`);
    console.log('📋 Список категорій:');
    final.forEach((cat, i) => {
      console.log(`   ${i + 1}. ${cat.emoji} ${cat.category_name} [${cat.category_key}]`);
    });
    
    console.log('\n🎉 Тепер категорії будуть відображатися в інструментах генерації!');
  }
}

seedCategories().catch(console.error);
