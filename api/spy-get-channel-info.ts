import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';

export const config = {
  runtime: 'nodejs',
};

interface RequestBody {
  session_string: string;
  channel_identifier: string; // @username, t.me/channel, +hash, -100123456789
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { session_string, channel_identifier } = req.body as RequestBody;

    if (!session_string || !channel_identifier) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing session_string or channel_identifier' 
      });
    }

    console.log('[Spy Get Channel Info] Connecting with session...');
    console.log('[Spy Get Channel Info] Channel identifier:', channel_identifier);

    // Initialize Telegram client
    const client = new TelegramClient(
      new StringSession(session_string),
      parseInt(process.env.TELEGRAM_API_ID || ''),
      process.env.TELEGRAM_API_HASH || '',
      {
        connectionRetries: 5,
      }
    );

    await client.connect();
    console.log('[Spy Get Channel Info] Client connected');

    // Resolve channel entity
    let entity;
    try {
      entity = await client.getEntity(channel_identifier);
      console.log('[Spy Get Channel Info] Entity resolved:', entity.className);
    } catch (err: any) {
      console.error('[Spy Get Channel Info] Failed to resolve entity:', err.message);
      await client.disconnect();
      return res.status(404).json({
        success: false,
        error: `Канал не знайдено або немає доступу: ${err.message}`
      });
    }

    // Get channel info
    const channelInfo: any = {
      id: entity.id?.toString(),
      title: entity.title || 'Unknown',
      username: entity.username || null,
    };

    // Get photo URL if available
    if (entity.photo) {
      try {
        const photo = await client.downloadProfilePhoto(entity, {
          isBig: true,
        });
        
        if (photo && Buffer.isBuffer(photo)) {
          // Convert to base64 or upload to storage
          // For now, just return null (implement storage later)
          channelInfo.photo_url = null;
        }
      } catch (photoErr) {
        console.error('[Spy Get Channel Info] Failed to download photo:', photoErr);
      }
    }

    // Get members count (for channels/supergroups)
    if (entity.className === 'Channel') {
      try {
        const fullChannel = await client.invoke(
          new Api.channels.GetFullChannel({ channel: entity })
        );
        
        channelInfo.members_count = fullChannel.fullChat.participantsCount || null;
        channelInfo.description = fullChannel.fullChat.about || null;
      } catch (err) {
        console.error('[Spy Get Channel Info] Failed to get full channel:', err);
      }
    }

    await client.disconnect();
    console.log('[Spy Get Channel Info] Success:', channelInfo.title);

    return res.status(200).json({
      success: true,
      channelInfo,
    });

  } catch (error: any) {
    console.error('[Spy Get Channel Info] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
