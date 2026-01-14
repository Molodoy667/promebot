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

    // Extract invite hash early if it's an invite link
    let inviteHash = '';
    let isInviteLink = false;
    if (channel_identifier.includes('t.me/+')) {
      inviteHash = channel_identifier.split('t.me/+')[1].split(/[?#]/)[0];
      isInviteLink = true;
    } else if (channel_identifier.includes('t.me/joinchat/')) {
      inviteHash = channel_identifier.split('t.me/joinchat/')[1].split(/[?#]/)[0];
      isInviteLink = true;
    }

    // Try to get entity first - if successful, already joined
    // For invite links, skip this check and go straight to join
    let alreadyJoined = false;
    if (!isInviteLink) {
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
    }

    // If not already joined, try to join
    if (!alreadyJoined) {
      try {
        console.log('[Spy Join Channel] Attempting to join channel...');
        
        // For invite links (t.me/+xxx or t.me/joinchat/xxx)
        if (isInviteLink) {
          if (!inviteHash) {
            throw new Error('Invalid invite link format');
          }
          
          console.log('[Spy Join Channel] Using invite hash:', inviteHash);
          
          try {
            const result = await client.invoke(
              new Api.messages.ImportChatInvite({
                hash: inviteHash,
              })
            );
            console.log('[Spy Join Channel] Successfully joined via invite link');
            console.log('[Spy Join Channel] Join result:', result);
          } catch (inviteErr: any) {
            // If already participant, that's fine
            if (inviteErr.message.includes('USER_ALREADY_PARTICIPANT')) {
              console.log('[Spy Join Channel] Already participant - getting entity');
              alreadyJoined = true;
            } else {
              throw inviteErr;
            }
          }
        }
        // For public channels with @username or clean username
        else if (channel_identifier.startsWith('@') || (!channel_identifier.startsWith('+') && !channel_identifier.startsWith('-'))) {
          const entity = await client.getEntity(channel_identifier);
          await client.invoke(
            new Api.channels.JoinChannel({
              channel: entity,
            })
          );
          console.log('[Spy Join Channel] Successfully joined public channel');
        } 
        // For chat IDs like -1001234567890
        else {
          console.log('[Spy Join Channel] Chat ID - cannot auto-join');
          await client.disconnect();
          return res.status(400).json({
            success: false,
            error: 'Cannot auto-join using chat ID. Use invite link or @username instead.'
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

    // Get channel info after joining
    let channelInfo: any = null;
    try {
      // For invite links, we need to get updates to find the channel
      if (isInviteLink) {
        console.log('[Spy Join Channel] Getting channel info via checkChatInvite...');
        const inviteInfo = await client.invoke(
          new Api.messages.CheckChatInvite({ hash: inviteHash })
        );
        
        if (inviteInfo.className === 'ChatInviteAlready') {
          const chat = inviteInfo.chat;
          // Convert BigInt ID to proper format for Bot API
          let chatId = chat.id?.toString() || '';
          // For channels, prepend -100 if not already there
          if (chat.className === 'Channel' && !chatId.startsWith('-100')) {
            chatId = `-100${chatId}`;
          }
          channelInfo = {
            id: chatId,
            title: (chat as any).title || 'Unknown',
            username: (chat as any).username || null,
          };
        } else if (inviteInfo.className === 'ChatInvite') {
          // We just joined, need to get from dialogs
          const dialogs = await client.getDialogs({ limit: 10 });
          const foundDialog = dialogs.find(d => 
            d.title === inviteInfo.title || 
            (d.entity && (d.entity as any).title === inviteInfo.title)
          );
          if (foundDialog && foundDialog.entity) {
            let entityId = foundDialog.entity.id?.toString() || '';
            // For channels, prepend -100 if not already there
            if (foundDialog.entity.className === 'Channel' && !entityId.startsWith('-100')) {
              entityId = `-100${entityId}`;
            }
            channelInfo = {
              id: entityId,
              title: (foundDialog.entity as any).title || inviteInfo.title,
              username: (foundDialog.entity as any).username || null,
            };
          }
        }
      } else {
        const entity = await client.getEntity(channel_identifier);
        let entityId = entity.id?.toString() || '';
        // For channels, prepend -100 if not already there
        if (entity.className === 'Channel' && !entityId.startsWith('-100')) {
          entityId = `-100${entityId}`;
        }
        channelInfo = {
          id: entityId,
          title: (entity as any).title || 'Unknown',
          username: (entity as any).username || null,
        };
      }
      console.log('[Spy Join Channel] Channel info:', channelInfo);
    } catch (err: any) {
      console.log('[Spy Join Channel] Could not get channel info after join:', err.message);
    }

    await client.disconnect();

    return res.status(200).json({
      success: true,
      already_joined: alreadyJoined,
      message: alreadyJoined ? 'Already a member' : 'Successfully joined channel',
      channelInfo
    });

  } catch (error: any) {
    console.error('[Spy Join Channel] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error',
    });
  }
}
