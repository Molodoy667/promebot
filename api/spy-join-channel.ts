import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface RequestBody {
  session_string: string;
  api_id: string;
  api_hash: string;
  channel_identifier: string; // @username, t.me/channel, -100123456789
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { session_string, api_id, api_hash, channel_identifier } = req.body as RequestBody;

    if (!session_string || !channel_identifier || !api_id || !api_hash) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required parameters' 
      });
    }

    console.log('[Spy Join Channel] Connecting...');
    console.log('[Spy Join Channel] Channel:', channel_identifier);

    // Initialize Telegram client
    const client = new TelegramClient(
      new StringSession(session_string),
      parseInt(api_id),
      api_hash,
      {
        connectionRetries: 5,
      }
    );

    await client.connect();
    console.log('[Spy Join Channel] Client connected');

    // Try to get entity first - if successful, already joined
    let alreadyJoined = false;
    try {
      const entity = await client.getEntity(channel_identifier);
      console.log('[Spy Join Channel] Channel found, checking membership...');
      
      // Try to get full channel info to confirm membership
      if (entity.className === 'Channel') {
        try {
          await client.invoke(
            new Api.channels.GetFullChannel({ channel: entity })
          );
          alreadyJoined = true;
          console.log('[Spy Join Channel] Already a member');
        } catch (err) {
          console.log('[Spy Join Channel] Not a member yet');
        }
      }
    } catch (err: any) {
      console.log('[Spy Join Channel] Channel not accessible, will try to join:', err.message);
    }

    // If not already joined, try to join
    if (!alreadyJoined) {
      try {
        console.log('[Spy Join Channel] Attempting to join channel...');
        
        // For public channels with @username
        if (channel_identifier.startsWith('@') || (!channel_identifier.startsWith('+') && !channel_identifier.startsWith('-'))) {
          const entity = await client.getEntity(channel_identifier);
          await client.invoke(
            new Api.channels.JoinChannel({
              channel: entity,
            })
          );
          console.log('[Spy Join Channel] Successfully joined public channel');
        } else {
          console.log('[Spy Join Channel] Private channel or chat ID - cannot auto-join');
          await client.disconnect();
          return res.status(400).json({
            success: false,
            error: 'Cannot auto-join private channels or chat IDs. Spy must be manually added.'
          });
        }
      } catch (joinErr: any) {
        console.error('[Spy Join Channel] Failed to join:', joinErr.message);
        await client.disconnect();
        return res.status(400).json({
          success: false,
          error: `Failed to join channel: ${joinErr.message}`
        });
      }
    }

    await client.disconnect();

    return res.status(200).json({
      success: true,
      already_joined: alreadyJoined,
      message: alreadyJoined ? 'Already a member' : 'Successfully joined channel'
    });

  } catch (error: any) {
    console.error('[Spy Join Channel] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
