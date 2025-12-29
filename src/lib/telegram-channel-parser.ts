/**
 * Універсальний парсер для Telegram каналів
 * Підтримує всі можливі формати вводу
 */

export interface ParsedChannel {
  /** Нормалізований формат для API (@username або chat_id) */
  normalized: string;
  /** Тип каналу */
  type: 'username' | 'chat_id';
  /** Оригінальне значення */
  original: string;
  /** Чи валідний формат */
  isValid: boolean;
  /** Помилка, якщо є */
  error?: string;
}

/**
 * Парсить будь-який формат Telegram каналу і повертає нормалізований вигляд
 * 
 * Підтримувані формати:
 * - @username
 * - username
 * - https://t.me/username
 * - http://t.me/username
 * - t.me/username
 * - https://telegram.me/username
 * - -1001234567890 (chat_id)
 * - -100123456789012345 (супер групи)
 * 
 * @param input - будь-який формат каналу
 * @returns ParsedChannel з нормалізованим форматом
 */
export function parseTelegramChannel(input: string): ParsedChannel {
  const original = input.trim();
  
  if (!original) {
    return {
      normalized: '',
      type: 'username',
      original,
      isValid: false,
      error: 'Канал не може бути пустим'
    };
  }

  // Перевірка на chat_id (починається з -, тільки цифри)
  const chatIdRegex = /^-\d+$/;
  if (chatIdRegex.test(original)) {
    // Це chat_id - використовуємо як є
    return {
      normalized: original,
      type: 'chat_id',
      original,
      isValid: true
    };
  }

  // Витягуємо username з різних форматів URL
  let username = original;

  // Паттерни для URL
  const urlPatterns = [
    /(?:https?:\/\/)?(?:www\.)?t(?:elegram)?\.me\/([a-zA-Z0-9_]+)/i,
    /(?:https?:\/\/)?(?:www\.)?telegram\.org\/([a-zA-Z0-9_]+)/i,
  ];

  for (const pattern of urlPatterns) {
    const match = original.match(pattern);
    if (match && match[1]) {
      username = match[1];
      break;
    }
  }

  // Видаляємо @ якщо є
  username = username.replace(/^@/, '');

  // Валідація username (Telegram правила)
  // Username: 5-32 символи, тільки a-z, A-Z, 0-9, underscore
  // Має починатися з букви
  const usernameRegex = /^[a-zA-Z][a-zA-Z0-9_]{4,31}$/;
  
  if (!usernameRegex.test(username)) {
    return {
      normalized: username,
      type: 'username',
      original,
      isValid: false,
      error: 'Невірний формат username. Username має містити 5-32 символи (букви, цифри, underscore) і починатися з букви.'
    };
  }

  // Додаємо @ до нормалізованого username
  return {
    normalized: `@${username}`,
    type: 'username',
    original,
    isValid: true
  };
}

/**
 * Швидка функція для отримання тільки нормалізованого значення
 */
export function normalizeTelegramChannel(input: string): string {
  const parsed = parseTelegramChannel(input);
  return parsed.normalized;
}

/**
 * Перевірка чи канал валідний
 */
export function isValidTelegramChannel(input: string): boolean {
  const parsed = parseTelegramChannel(input);
  return parsed.isValid;
}

/**
 * Отримати помилку валідації
 */
export function getTelegramChannelError(input: string): string | undefined {
  const parsed = parseTelegramChannel(input);
  return parsed.error;
}

/**
 * Приклади використання:
 * 
 * parseTelegramChannel('@mychannel')           → '@mychannel'
 * parseTelegramChannel('mychannel')            → '@mychannel'
 * parseTelegramChannel('https://t.me/mychannel') → '@mychannel'
 * parseTelegramChannel('t.me/mychannel')       → '@mychannel'
 * parseTelegramChannel('-1001234567890')       → '-1001234567890'
 */
