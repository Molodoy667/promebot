import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl';
import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Spammer Join Channel API
 * Підключення спамера до Telegram каналу через Vercel
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { 
      spammerId, 
      channelUsername, 
      apiId, 
      apiHash, 
      sessionString 
    } = req.body;

    // Валідація
    if (!spammerId) {
      return res.status(400).json({ error: 'spammerId is required' });
    }

    if (!channelUsername) {
      return res.status(400).json({ error: 'channelUsername is required' });
    }

    if (!apiId || !apiHash) {
      return res.status(400).json({ 
        error: 'apiId and apiHash are required. Get them from https://my.telegram.org/apps' 
      });
    }

    if (!sessionString) {
      return res.status(400).json({ 
        error: 'sessionString is required (from telegram_spammers.authkey)' 
      });
    }

    console.log(`[Vercel Spammer] Connecting spammer ${spammerId} to ${channelUsername}`);

    // Створити Telegram клієнт
    const client = new TelegramClient(
      new StringSession(sessionString),
      parseInt(apiId),
      apiHash,
      { connectionRetries: 5 }
    );

    await client.connect();
    console.log('[Vercel Spammer] Connected to Telegram');

    // Перевірка авторизації
    const isAuthorized = await client.isUserAuthorized();
    if (!isAuthorized) {
      await client.disconnect();
      return res.status(401).json({ 
        error: 'Spammer is not authorized. Session may be expired.' 
      });
    }

    console.log('[Vercel Spammer] Spammer is authorized');

    // Видалити @ якщо є
    const channelName = channelUsername.replace('@', '');

    // Спроба приєднатись до каналу
    try {
      const result = await client.invoke(
        new Api.channels.JoinChannel({
          channel: channelName
        })
      );

      console.log('[Vercel Spammer] Successfully joined channel:', channelName);

      // Отримати інформацію про канал
      let channelInfo: any = null;
      try {
        const entity = await client.getEntity(channelName);
        const fullChannel = await client.invoke(
          new Api.channels.GetFullChannel({ channel: entity })
        );
        
        const chatFull = fullChannel.fullChat as any;
        channelInfo = {
          id: entity.id?.toString(),
          title: (entity as any).title,
          username: (entity as any).username,
          participantsCount: chatFull.participantsCount || 0,
        };
      } catch (infoError) {
        console.warn('[Vercel Spammer] Could not get channel info:', infoError);
      }

      await client.disconnect();

      return res.status(200).json({
        success: true,
        message: `Successfully joined channel @${channelName}`,
        spammerId,
        channel: {
          username: channelName,
          ...channelInfo,
        },
      });

    } catch (joinError: any) {
      await client.disconnect();

      // Перевірка чи вже є учасником
      if (joinError.message && joinError.message.includes('USER_ALREADY_PARTICIPANT')) {
        console.log('[Vercel Spammer] Already a participant');
        
        return res.status(200).json({
          success: true,
          message: `Already a participant of @${channelName}`,
          spammerId,
          channel: { username: channelName },
          alreadyJoined: true,
        });
      }

      // Інші помилки
      console.error('[Vercel Spammer] Join error:', joinError);
      return res.status(400).json({
        error: joinError.message || 'Failed to join channel',
        details: joinError.toString(),
      });
    }

  } catch (error: any) {
    console.error('[Vercel Spammer] Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error',
      details: error.toString(),
    });
  }
}
