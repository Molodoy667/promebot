# 🚀 Manual Deploy: Spammer Functions

## Швидкий спосіб через Supabase Dashboard

### 1. Deploy test-spammer

1. Відкрийте: https://supabase.com/dashboard/project/vtrkcgaajgtlkjqcnwxk/functions
2. Натисніть **"Deploy a new function"** або **"Create function"**
3. Заповніть:
   - **Function name:** `test-spammer`
   - **Verify JWT:** ❌ вимкнено
   - **Code:** Скопіюйте з `supabase/functions/test-spammer/index.ts`
4. Натисніть **Deploy**

### 2. Deploy authorize-spammer

1. На тій самій сторінці натисніть **"Deploy a new function"**
2. Заповніть:
   - **Function name:** `authorize-spammer`
   - **Verify JWT:** ❌ вимкнено
   - **Code:** Скопіюйте з `supabase/functions/authorize-spammer/index.ts`
3. Натисніть **Deploy**

### 3. Перевірка

Після деплою:
- Відкрийте адмінку → Боти → Спамери
- Додайте спамера
- Натисніть "Авторизувати" або "Тест"
- Має спрацювати без помилок

## Альтернатива: CLI з правильним токеном

Якщо хочете через CLI:

1. Перейдіть: https://supabase.com/dashboard/account/tokens
2. В розділі **"Personal Access Tokens"** (не Project API keys!)
3. Generate New Token → назвіть "CLI"
4. Токен має формат: `sbp_1234567890...` (тільки цифри після sbp_)
5. Додайте в .env: `SUPABASE_ACCESS_TOKEN=sbp_ваш_токен`
6. Запустіть:
   ```bash
   supabase link --project-ref vtrkcgaajgtlkjqcnwxk
   supabase functions deploy test-spammer --no-verify-jwt
   supabase functions deploy authorize-spammer --no-verify-jwt
   ```

## Код функцій

Файли для копіювання:
- `supabase/functions/test-spammer/index.ts`
- `supabase/functions/authorize-spammer/index.ts`
