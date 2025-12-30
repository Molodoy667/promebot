# 🚀 Деплой Vercel API для Userbot Auth

## Проблема
API `userbot-auth.ts` на Vercel використовує старий код, тому авторизація userbot не працює (PHONE_CODE_INVALID).

## Рішення

### Варіант 1: Деплой через Vercel Dashboard

1. Перейдіть на **https://vercel.com/dashboard**
2. Відкрийте проєкт `promobot` (або той, що на `promobot.store`)
3. Перейдіть: **Settings → Git → Reconnect Repository**
4. Або натисніть **Deploy** → push останні зміни з GitHub
5. Vercel автоматично задеплоїть `api/userbot-auth.ts`

### Варіант 2: Деплой через CLI

```bash
# Встановити Vercel CLI
npm i -g vercel

# Login
vercel login

# Деплой
cd promebot
vercel --prod
```

### Варіант 3: Push на GitHub (якщо підключено auto-deploy)

```bash
git push origin main
```

Vercel автоматично задеплоїть зміни, якщо налаштовано інтеграцію з GitHub.

## Що змінилось в `api/userbot-auth.ts`

**Було:**
```typescript
await client.start({
  phoneNumber: async () => phoneNumber,
  phoneCode: async () => phoneCode,
  // ❌ phoneCodeHash НЕ передавався!
});
```

**Стало:**
```typescript
await client.signInUser(
  { apiId: parseInt(apiId), apiHash },
  {
    phoneNumber: async () => phoneNumber,
    phoneCode: async () => phoneCode,
    phoneCodeHash: async () => phoneCodeHash, // ✅ Тепер передається!
  }
);
```

## Перевірка після деплою

```bash
node scripts/tmp_rovodev_test_vercel_api.js
```

Або спробувати авторизувати userbot в UI.

## Якщо проблема залишилась

Можна переписати Edge Function без Vercel, використавши GramJS напряму в Deno (складніше, але не потрібен окремий сервер).
