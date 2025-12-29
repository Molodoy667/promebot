/**
 * Telegram Rate Limiter
 * 
 * Telegram API має ліміт ~30 запитів/секунду
 * Цей клас забезпечує автоматичну черговість запитів
 */

interface QueueItem {
  fn: () => Promise<any>;
  resolve: (value: any) => void;
  reject: (error: any) => void;
}

class TelegramRateLimiter {
  private queue: QueueItem[] = [];
  private processing = false;
  private lastRequestTime = 0;
  private minInterval = 35; // ~28 req/sec для безпеки

  /**
   * Виконати запит з Rate Limiting
   */
  async executeRequest<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push({ fn, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Обробка черги запитів
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) {
      return;
    }

    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;

      // Почекати якщо потрібно
      if (timeSinceLastRequest < this.minInterval) {
        await this.sleep(this.minInterval - timeSinceLastRequest);
      }

      const item = this.queue.shift();
      if (!item) break;

      try {
        this.lastRequestTime = Date.now();
        const result = await item.fn();
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    }

    this.processing = false;
  }

  /**
   * Затримка
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Отримати розмір черги
   */
  getQueueSize(): number {
    return this.queue.length;
  }

  /**
   * Очистити чергу
   */
  clearQueue(): void {
    this.queue = [];
  }
}

// Singleton instance
export const telegramLimiter = new TelegramRateLimiter();

/**
 * Wrapper функція для легкого використання
 */
export async function rateLimitedFetch(url: string, options?: RequestInit): Promise<Response> {
  return telegramLimiter.executeRequest(() => fetch(url, options));
}
