/**
 * Об'єднує дані з обох методів збору статистики
 * Пріоритет: MTProto > Scraping (точніші дані)
 * Fallback: якщо один метод не працює, використовуємо інший
 */

interface StatsData {
  views?: number;
  reactions?: number;
  forwards?: number;
  timestamp?: string;
  method?: string;
}

interface PostWithStats {
  id: string;
  message_id?: number;
  views?: number;
  reactions?: number;
  scraping_stats?: StatsData;
  mtproto_stats?: StatsData;
}

interface MergedStats {
  views: number;
  reactions: number;
  forwards: number;
  source: 'mtproto' | 'scraping' | 'combined';
  confidence: 'high' | 'medium' | 'low';
  lastUpdated: string;
  hasBothMethods: boolean;
}

/**
 * Об'єднує статистику з пріоритетом на MTProto
 */
export function mergeStats(post: PostWithStats): MergedStats {
  const scrapingStats = post.scraping_stats;
  const mtprotoStats = post.mtproto_stats;

  // Випадок 1: Є обидва методи (найкраще)
  if (mtprotoStats && scrapingStats) {
    return {
      views: mtprotoStats.views || scrapingStats.views || post.views || 0,
      reactions: mtprotoStats.reactions || scrapingStats.reactions || 0,
      forwards: mtprotoStats.forwards || 0,
      source: 'combined',
      confidence: 'high',
      lastUpdated: mtprotoStats.timestamp || scrapingStats.timestamp || new Date().toISOString(),
      hasBothMethods: true,
    };
  }

  // Випадок 2: Тільки MTProto (добре)
  if (mtprotoStats) {
    return {
      views: mtprotoStats.views || post.views || 0,
      reactions: mtprotoStats.reactions || 0,
      forwards: mtprotoStats.forwards || 0,
      source: 'mtproto',
      confidence: 'high',
      lastUpdated: mtprotoStats.timestamp || new Date().toISOString(),
      hasBothMethods: false,
    };
  }

  // Випадок 3: Тільки Scraping (нормально)
  if (scrapingStats) {
    return {
      views: scrapingStats.views || post.views || 0,
      reactions: scrapingStats.reactions || 0,
      forwards: 0,
      source: 'scraping',
      confidence: 'medium',
      lastUpdated: scrapingStats.timestamp || new Date().toISOString(),
      hasBothMethods: false,
    };
  }

  // Випадок 4: Тільки старі дані з БД (fallback)
  return {
    views: post.views || 0,
    reactions: 0,
    forwards: 0,
    source: 'scraping',
    confidence: 'low',
    lastUpdated: new Date().toISOString(),
    hasBothMethods: false,
  };
}

/**
 * Пакетна обробка постів з об'єднанням статистики
 */
export function mergePostsStats<T extends PostWithStats>(posts: T[]): (T & { mergedStats: MergedStats })[] {
  return posts.map(post => ({
    ...post,
    mergedStats: mergeStats(post),
  }));
}

/**
 * Отримати іконку методу
 */
export function getStatsSourceIcon(source: MergedStats['source']): string {
  switch (source) {
    case 'mtproto':
      return '👁️';
    case 'scraping':
      return '🌐';
    case 'combined':
      return '⚡';
    default:
      return '📊';
  }
}

/**
 * Отримати колір достовірності
 */
export function getConfidenceColor(confidence: MergedStats['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'text-green-600';
    case 'medium':
      return 'text-yellow-600';
    case 'low':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

/**
 * Отримати текст достовірності
 */
export function getConfidenceText(confidence: MergedStats['confidence']): string {
  switch (confidence) {
    case 'high':
      return 'Висока точність';
    case 'medium':
      return 'Середня точність';
    case 'low':
      return 'Низька точність';
    default:
      return 'Невідомо';
  }
}

/**
 * Перевірити чи статистика свіжа (менше 1 години)
 */
export function isStatsFresh(timestamp: string): boolean {
  const now = new Date();
  const statsTime = new Date(timestamp);
  const diffMinutes = (now.getTime() - statsTime.getTime()) / (1000 * 60);
  return diffMinutes < 60;
}

/**
 * Форматувати час оновлення
 */
export function formatUpdateTime(timestamp: string): string {
  const now = new Date();
  const statsTime = new Date(timestamp);
  const diffMinutes = Math.floor((now.getTime() - statsTime.getTime()) / (1000 * 60));

  if (diffMinutes < 1) return 'Щойно';
  if (diffMinutes < 60) return `${diffMinutes} хв тому`;
  
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours} год тому`;
  
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} дн тому`;
}
