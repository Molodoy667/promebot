/**
 * Custom Hook для роботи з Telegram API з Rate Limiting
 */

import { rateLimitedFetch } from "@/lib/telegram-rate-limiter";
import { botChecksCache } from "@/lib/bot-checks-cache";

interface TelegramAPIOptions {
  useCache?: boolean;
  cacheTTL?: number;
}

export const useTelegramAPI = () => {
  /**
   * Перевірити права бота в каналі (з кешуванням)
   */
  const checkBotAdmin = async (
    botToken: string,
    channelUsername: string,
    options: TelegramAPIOptions = { useCache: true }
  ) => {
    // Спробувати отримати з кешу
    if (options.useCache) {
      const cached = botChecksCache.get(botToken, channelUsername);
      if (cached) {
        console.log('✅ Using cached bot check result');
        return cached;
      }
    }

    // Виконати запит з rate limiting
    const botId = botToken.split(':')[0];
    const url = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${channelUsername}&user_id=${botId}`;
    
    try {
      const response = await rateLimitedFetch(url);
      const data = await response.json();

      if (!data.ok) {
        const result = {
          isAdmin: false,
          isMember: false,
          message: 'Бот не доданий до каналу'
        };
        
        if (options.useCache) {
          botChecksCache.set(botToken, channelUsername, result);
        }
        
        return result;
      }

      const member = data.result;
      const isAdmin = member.status === 'administrator' || member.status === 'creator';
      const isMember = true;
      
      const result = {
        isAdmin,
        isMember,
        message: isAdmin 
          ? 'Бот успішно підключений і має всі необхідні права!'
          : 'Бот доданий до каналу, але не має прав адміністратора'
      };

      // Зберегти в кеш
      if (options.useCache) {
        botChecksCache.set(botToken, channelUsername, result);
      }

      return result;
    } catch (error) {
      console.error('Error checking bot admin:', error);
      throw error;
    }
  };

  /**
   * Отримати інформацію про канал
   */
  const getChannelInfo = async (botToken: string, channelUsername: string) => {
    const url = `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${channelUsername}`;
    
    try {
      const response = await rateLimitedFetch(url);
      const data = await response.json();

      if (!data.ok) {
        throw new Error('Канал не знайдено');
      }

      return data.result;
    } catch (error) {
      console.error('Error getting channel info:', error);
      throw error;
    }
  };

  /**
   * Відправити повідомлення
   */
  const sendMessage = async (
    botToken: string,
    chatId: string,
    text: string,
    options?: {
      parse_mode?: 'HTML' | 'Markdown';
      disable_web_page_preview?: boolean;
    }
  ) => {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    try {
      const response = await rateLimitedFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...options
        })
      });

      const data = await response.json();

      if (!data.ok) {
        throw new Error(data.description || 'Failed to send message');
      }

      return data.result;
    } catch (error) {
      console.error('Error sending message:', error);
      throw error;
    }
  };

  /**
   * Очистити кеш для конкретного бота
   */
  const clearBotCache = (botToken: string, channelUsername?: string) => {
    if (channelUsername) {
      botChecksCache.delete(botToken, channelUsername);
    } else {
      botChecksCache.clear();
    }
  };

  return {
    checkBotAdmin,
    getChannelInfo,
    sendMessage,
    clearBotCache
  };
};
