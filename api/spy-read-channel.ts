import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

export const config = {
  runtime: 'nodejs',
};

interface RequestBody {
  session_string: string;
  api_id: string;
  api_hash: string;
  channel_identifier: string;
  limit?: number;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { session_string, api_id, api_hash, channel_identifier, limit = 10 } = req.body as RequestBody;

    if (!session_string || !channel_identifier || !api_id || !api_hash) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters: session_string, api_id, api_hash, channel_identifier' 
      });
    }

    console.log('[Spy Read Channel] Connecting with session...');
    console.log('[Spy Read Channel] Channel:', channel_identifier, 'Limit:', limit);

    // Initialize Telegram client with provided API credentials
    const client = new TelegramClient(
      new StringSession(session_string),
      parseInt(api_id),
      api_hash,
      {
        connectionRetries: 5,
      }
    );

    await client.connect();
    console.log('[Spy Read Channel] Client connected');

    // Resolve channel entity
    let entity;
    try {
      entity = await client.getEntity(channel_identifier);
      console.log('[Spy Read Channel] Entity resolved:', entity.className);
    } catch (err: any) {
      console.error('[Spy Read Channel] Failed to resolve entity:', err.message);
      await client.disconnect();
      return res.status(404).json({
        success: false,
        error: `Канал не знайдено або немає доступу: ${err.message}`
      });
    }

    // Get messages
    const messages: any[] = [];
    
    try {
      const result = await client.getMessages(entity, { limit });
      
      for (const msg of result) {
        if (!msg.message && !msg.media) continue;
        
        const messageData: any = {
          id: msg.id,
          text: msg.message || '',
          date: msg.date ? new Date(msg.date * 1000).toISOString() : new Date().toISOString(),
          views: msg.views || 0,
          forwards: msg.forwards || 0,
        };

        // Handle media
        if (msg.media) {
          messageData.media = {
            type: msg.media.className,
            url: null, // Implement media download if needed
          };
        }

        messages.push(messageData);
      }

      console.log('[Spy Read Channel] Read', messages.length, 'messages');
    } catch (err: any) {
      console.error('[Spy Read Channel] Failed to get messages:', err.message);
      await client.disconnect();
      return res.status(500).json({
        success: false,
        error: `Не вдалося прочитати пости: ${err.message}`
      });
    }

    await client.disconnect();

    return res.status(200).json({
      success: true,
      messages,
    });

  } catch (error: any) {
    console.error('[Spy Read Channel] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
