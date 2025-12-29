import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import { Api } from 'telegram/tl';
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { apiId, apiHash, sessionString, channelUsername, messageIds } = req.body;

    if (!apiId || !apiHash || !sessionString) {
      return res.status(400).json({ 
        error: 'apiId, apiHash, and sessionString are required' 
      });
    }

    if (!channelUsername || !messageIds || !Array.isArray(messageIds)) {
      return res.status(400).json({ 
        error: 'channelUsername and messageIds (array) are required' 
      });
    }

    console.log(`[Vercel MTProto] Collecting stats for @${channelUsername}, ${messageIds.length} posts`);

    const client = new TelegramClient(
      new StringSession(sessionString),
      parseInt(apiId),
      apiHash,
      { connectionRetries: 3 }
    );

    await client.connect();

    // Get channel info
    const channel = await client.getEntity(channelUsername);
    
    let participantsCount = 0;
    try {
      const fullChannel = await client.invoke(
        new Api.channels.GetFullChannel({ channel })
      );
      const chatFull = fullChannel.fullChat as any;
      participantsCount = chatFull.participantsCount || 0;
    } catch (err) {
      console.warn('[Vercel MTProto] Could not get participants count');
    }

    // Get messages stats
    const stats: any[] = [];
    
    for (const messageId of messageIds) {
      try {
        const messages = await client.getMessages(channel, { ids: [messageId] });
        
        if (messages && messages.length > 0) {
          const msg = messages[0];
          
          let reactionsCount = 0;
          if (msg.reactions && msg.reactions.results) {
            reactionsCount = msg.reactions.results.reduce((sum: number, r: any) => {
              return sum + (r.count || 0);
            }, 0);
          }

          stats.push({
            messageId: messageId,
            views: msg.views || 0,
            forwards: msg.forwards || 0,
            reactions: reactionsCount,
            postDate: msg.date ? new Date(msg.date * 1000).toISOString() : null,
            editDate: msg.editDate ? new Date(msg.editDate * 1000).toISOString() : null,
          });
        }
      } catch (err) {
        console.error(`[Vercel MTProto] Error getting message ${messageId}:`, err);
        stats.push({
          messageId: messageId,
          error: 'Could not fetch message',
        });
      }
    }

    await client.disconnect();

    console.log(`[Vercel MTProto] Collected stats for ${stats.length} posts`);

    return res.status(200).json({
      success: true,
      channelInfo: {
        username: channelUsername,
        participantsCount,
      },
      stats,
    });

  } catch (error: any) {
    console.error('[Vercel MTProto] Error:', error);
    return res.status(500).json({ 
      error: error.message || 'Internal server error' 
    });
  }
}
