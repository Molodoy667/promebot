/**
 * Bot Checks Cache
 * 
 * Кешує результати перевірок ботів щоб зменшити кількість запитів до Telegram API
 */

interface CacheEntry {
  isAdmin: boolean;
  isMember: boolean;
  message: string;
  cachedAt: number;
}

class BotChecksCache {
  private cache = new Map<string, CacheEntry>();
  private ttl = 5 * 60 * 1000; // 5 хвилин

  /**
   * Отримати закешований результат
   */
  get(botToken: string, channelUsername: string): CacheEntry | null {
    const key = this.generateKey(botToken, channelUsername);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.cachedAt;
    
    // Якщо запис застарів - видалити
    if (age > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  /**
   * Зберегти результат в кеш
   */
  set(
    botToken: string,
    channelUsername: string,
    data: Omit<CacheEntry, 'cachedAt'>
  ): void {
    const key = this.generateKey(botToken, channelUsername);
    this.cache.set(key, {
      ...data,
      cachedAt: Date.now()
    });
  }

  /**
   * Видалити запис з кешу
   */
  delete(botToken: string, channelUsername: string): void {
    const key = this.generateKey(botToken, channelUsername);
    this.cache.delete(key);
  }

  /**
   * Очистити весь кеш
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Отримати розмір кешу
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Видалити застарілі записи
   */
  cleanup(): void {
    const now = Date.now();
    
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.cachedAt;
      if (age > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Генерувати ключ кешу
   */
  private generateKey(botToken: string, channelUsername: string): string {
    // Використовуємо тільки частину токена для безпеки
    const tokenHash = botToken.split(':')[0];
    const channelNormalized = channelUsername.replace('@', '').toLowerCase();
    return `${tokenHash}:${channelNormalized}`;
  }

  /**
   * Отримати статистику кешу
   */
  getStats(): {
    size: number;
    oldestEntry: number | null;
    newestEntry: number | null;
  } {
    const entries = Array.from(this.cache.values());
    
    if (entries.length === 0) {
      return { size: 0, oldestEntry: null, newestEntry: null };
    }

    const times = entries.map(e => e.cachedAt);
    
    return {
      size: entries.length,
      oldestEntry: Math.min(...times),
      newestEntry: Math.max(...times)
    };
  }
}

// Singleton instance
export const botChecksCache = new BotChecksCache();

// Автоматичне очищення кешу кожні 10 хвилин
if (typeof window !== 'undefined') {
  setInterval(() => {
    botChecksCache.cleanup();
  }, 10 * 60 * 1000);
}
