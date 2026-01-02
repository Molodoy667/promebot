import { Api, TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions/index.js';
import type { VercelRequest, VercelResponse } from '@vercel/node';

interface RequestBody {
  session_string: string;
  api_id: string;
  api_hash: string;
  channel_identifier: string; // @username, t.me/channel, +hash, -100123456789
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
        error: 'Missing required parameters: session_string, api_id, api_hash, channel_identifier' 
      });
    }

    console.log('[Spy Get Channel Info] Connecting with session...');
    console.log('[Spy Get Channel Info] Channel identifier:', channel_identifier);

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
    console.log('[Spy Get Channel Info] Client connected');

    // Resolve channel entity
    let entity;
    try {
      // If it's an invite link (+hash), check if already joined first
      if (channel_identifier.startsWith('+')) {
        console.log('[Spy Get Channel Info] Invite link detected, checking if already joined...');
        
        const hash = channel_identifier.substring(1); // Remove '+'
        let alreadyJoined = false;
        
        // Try to check invite first
        try {
          const checkInvite: any = await client.invoke(
            new Api.messages.CheckChatInvite({
              hash: hash,
            })
          );
          
          // If chat is returned, we're already a member
          if (checkInvite.chat) {
            console.log('[Spy Get Channel Info] Already joined to this channel');
            entity = checkInvite.chat;
            alreadyJoined = true;
          }
        } catch (checkErr: any) {
          console.log('[Spy Get Channel Info] CheckChatInvite error (will try to join):', checkErr.message);
        }
        
        // If not already joined, join now
        if (!alreadyJoined) {
          console.log('[Spy Get Channel Info] Not joined yet, joining channel...');
          try {
            const result: any = await client.invoke(
              new Api.messages.ImportChatInvite({
                hash: hash,
              })
            );
            console.log('[Spy Get Channel Info] Successfully joined via invite');
            
            // Get channel from result
            if (result.chats && result.chats.length > 0) {
              entity = result.chats[0];
            }
          } catch (joinErr: any) {
            // If already joined (race condition), ignore error
            if (joinErr.message.includes('USER_ALREADY_PARTICIPANT')) {
              console.log('[Spy Get Channel Info] Already participant (race condition)');
            } else if (joinErr.message.includes('INVITE_REQUEST_SENT')) {
              await client.disconnect();
              return res.status(400).json({
                success: false,
                error: 'Заявка на вступ відправлена. Дочекайтесь підтвердження адміністратора каналу.'
              });
            } else {
              throw joinErr;
            }
          }
        }
      }
      
      // If not invite link or join didn't return entity, get it normally
      if (!entity) {
        entity = await client.getEntity(channel_identifier);
      }
      
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
      photo_url: null,
    };

    console.log('[Spy Get Channel Info] Basic info:', {
      id: channelInfo.id,
      title: channelInfo.title,
      username: channelInfo.username,
      hasPhoto: !!entity.photo,
    });

    // Get photo URL if available
    if (entity.photo) {
      try {
        console.log('[Spy Get Channel Info] Downloading channel photo...');
        
        // Download profile photo as buffer
        const photoBuffer = await client.downloadProfilePhoto(entity, {
          isBig: true,
        });
        
        if (photoBuffer && Buffer.isBuffer(photoBuffer)) {
          // Upload to Supabase Storage
          const { createClient } = await import('@supabase/supabase-js');
          const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || '',
            process.env.SUPABASE_SERVICE_ROLE_KEY || ''
          );
          
          const fileName = `channel_${channelInfo.id}_${Date.now()}.jpg`;
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from('channel-avatars')
            .upload(fileName, photoBuffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });
          
          if (uploadError) {
            console.error('[Spy Get Channel Info] Upload error:', uploadError);
          } else {
            // Get public URL
            const { data: urlData } = supabase.storage
              .from('channel-avatars')
              .getPublicUrl(fileName);
            
            channelInfo.photo_url = urlData.publicUrl;
            console.log('[Spy Get Channel Info] Photo uploaded:', channelInfo.photo_url);
          }
        }
      } catch (photoErr) {
        console.error('[Spy Get Channel Info] Failed to process photo:', photoErr);
      }
    }

    // Get members count (for channels/supergroups)
    if (entity.className === 'Channel') {
      try {
        const fullChannel = await client.invoke(
          new Api.channels.GetFullChannel({ channel: entity })
        );
        
        const fullChat = fullChannel.fullChat as any;
        channelInfo.members_count = fullChat.participantsCount || null;
        channelInfo.description = fullChat.about || null;
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
