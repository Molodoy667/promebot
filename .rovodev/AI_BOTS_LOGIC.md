# 🤖 ЛОГІКА РОБОТИ AI БОТІВ - ВІД А ДО Я

## 📊 СТРУКТУРА ТАБЛИЦЬ

### 1. **ai_bot_services** - Налаштування AI бота
- id - унікальний ID сервісу
- user_id - власник бота
- bot_id - прив'язка до telegram_bots
- target_channel - канал для публікації
- service_type - тип ('category_generation')
- is_running - статус (запущений/зупинений)
- subscription_id - підписка користувача
- created_at, started_at

### 2. **ai_generated_posts** - Згенеровані пости
- id
- ai_bot_service_id - прив'язка до сервісу
- category - категорія посту
- post_content / content - текст
- image_url - зображення
- status - 'scheduled', 'published', 'failed'
- created_at, published_at, scheduled_for

### 3. **ai_bot_settings** - Налаштування публікації
- ai_bot_service_id
- selected_categories - масив категорій
- publish_time_from, publish_time_to - часовий діапазон
- post_interval_minutes - інтервал публікації
- include_media - з медіа чи ні
- use_custom_prompt - свій промпт
- custom_prompt - текст промпту
- generate_tags - генерувати хештеги

---

## 🔄 ПРОЦЕС РОБОТИ

### КРОК 1: Створення AI бота (AIBotSetup.tsx)

1. **Вибір бота**
   - Користувач обирає Telegram бота з dropdown
   - Бот має бути додан через BotSelector

2. **Вказати цільовий канал**
   - @channel_name або -100123456789
   - Перевірка через \check_channel_ownership\
   - Валідація через Telegram API

3. **Вибір категорій**
   - Завантаження з таблиці \categories\
   - Мультивибір (чекбокси)
   - Мінімум 1 категорія

4. **Налаштування публікації**
   - Часовий діапазон (09:00-22:00)
   - Інтервал (60 хв за замовчуванням)
   - Include media: так/ні
   - Custom prompt: опційно
   - Generate tags: так/ні

5. **Збереження**
   - INSERT в \i_bot_services\
   - INSERT в \i_bot_settings\

---

### КРОК 2: Генерація постів (generate-ai-posts Edge Function)

**Викликається через:**
- Cron job (кожні 5-15 хвилин)
- OR ручна генерація через UI

**Алгоритм:**
\\\	ypescript
1. Знайти активні AI сервіси (is_running = true)
2. Для кожного сервісу:
   a. Завантажити налаштування (ai_bot_settings)
   b. Перевірити ліміт постів (posts_per_month)
   c. Порахувати вже заплановані пости (status = 'scheduled')
   d. Якщо потрібно більше постів:
      - Обрати випадкову категорію
      - Завантажити промпт категорії (category_prompts)
      - Викликати AI API (OpenAI/Claude/Gemini)
      - Згенерувати контент
      - Згенерувати зображення (якщо include_media)
      - Розрахувати scheduled_for (з урахуванням інтервалу)
      - INSERT в ai_generated_posts
\\\

**Приклад промпту:**
\\\
Категорія: Технології
Промпт: "Створи цікавий пост про нові технології..."
Custom prompt (якщо є): "Додай більше технічних деталей"
Generate tags: true → додає #технології #новини #AI
\\\

---

### КРОК 3: Публікація постів (ai-bot-worker Edge Function)

**Викликається через:**
- Cron job (кожну хвилину)

**Алгоритм:**
\\\	ypescript
1. Знайти пости де:
   - status = 'scheduled'
   - scheduled_for <= NOW()
   - ai_bot_service.is_running = true

2. Для кожного посту:
   a. Перевірити часовий діапазон (time_from, time_to)
   b. Завантажити bot_token
   c. Відправити в Telegram API:
      - Якщо є image_url: sendPhoto
      - Інакше: sendMessage
   d. Оновити статус:
      - SUCCESS → status = 'published', published_at = NOW()
      - ERROR → status = 'failed', error_message = ...
\\\

---

## 🎯 ОСОБЛИВОСТІ

### Ліміти
- \posts_per_month\ з тарифу
- Рахується через: COUNT(*) WHERE created_at >= monthAgo

### Інтервали публікації
- \post_interval_minutes\ - мінімальна пауза між постами
- \scheduled_for\ розраховується: last_post_time + interval

### Часові фільтри
- Якщо enable_time_filter = true
- Пости публікуються лише між time_from і time_to

### Custom Prompt
- Якщо use_custom_prompt = true
- Додається до базового промпту категорії

### Хештеги
- Якщо generate_tags = true
- AI додає релевантні хештеги в кінець

---

## 🔧 УПРАВЛІННЯ

### Запуск/Зупинка
- UPDATE ai_bot_services SET is_running = true/false
- Якщо зупинено - генерація і публікація припиняються

### Моніторинг
- Real-time через Supabase channels
- Показує статус: 🟢 Працює / 🔴 Зупинено

### Видалення постів
- Можна видалити з черги (DELETE WHERE status = 'scheduled')
- Опубліковані пости залишаються в історії

---

## 📈 СТАТИСТИКА

### MyChannels.tsx
- Показує кількість постів за місяць
- \usageStats.posts_month\ / \	ariff.posts_per_month\

### BotSetup.tsx  
- Те саме + статистика по джерелах

---

## ⚠️ ПОМИЛКИ

### Типові проблеми:
1. **Bot is not admin** - бот не адмін каналу
2. **Channel not found** - невірний ID/username
3. **AI API error** - проблеми з OpenAI/Claude
4. **Limit exceeded** - перевищено ліміт постів
5. **Image generation failed** - помилка генерації зображення

---

## 🔐 БЕЗПЕКА

- RLS policies на всі таблиці
- Користувач бачить лише свої AI сервіси
- Bot token зберігається зашифрованим
- Перевірка ownership каналу

---

Це повний цикл від створення до публікації! Що саме потрібно виправити?
