# 🚀 Деплой без GitHub Actions

Якщо у вас немає тарифу GitHub Actions, можна задеплоїти Edge Functions вручну.

## Варіант 1: Через Supabase CLI (найпростіше)

```bash
# Встановити CLI (якщо немає)
npm install -g supabase

# Login
supabase login

# Деплой функції
supabase functions deploy authorize-userbot --no-verify-jwt --project-ref vtrkcgaajgtlkjqcnwxk
```

## Варіант 2: Через скрипт (без CLI)

```bash
# 1. Отримати Personal Access Token
# Перейдіть: https://supabase.com/dashboard/account/tokens
# Створіть новий токен

# 2. Додайте в .env
echo "SUPABASE_ACCESS_TOKEN=sbp_ваш_токен" >> .env

# 3. Запустіть скрипт
node scripts/tmp_rovodev_deploy_function.js
```

## Варіант 3: Через Supabase Dashboard

1. Перейдіть: **Supabase Dashboard → Edge Functions**
2. Клікніть на **authorize-userbot**
3. Натисніть **Edit function**
4. Скопіюйте код з `supabase/functions/authorize-userbot/index.ts`
5. Вставте і натисніть **Deploy**

## Автоматичний деплой (без GitHub Actions)

Можна налаштувати webhook:

1. Встановіть Vercel CLI: `npm i -g vercel`
2. Створіть `vercel.json` з webhook на деплой
3. Або використовуйте GitLab CI / Bitbucket Pipelines (безкоштовні)

## Перевірка після деплою

```bash
# Перевірити версію функції
curl https://vtrkcgaajgtlkjqcnwxk.supabase.co/functions/v1/authorize-userbot \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```
