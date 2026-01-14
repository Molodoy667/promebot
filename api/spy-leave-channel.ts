import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { spy_id, channel_identifier } = req.body;

    if (!spy_id || !channel_identifier) {
      return res.status(400).json({ 
        success: false, 
        error: 'spy_id and channel_identifier are required' 
      });
    }

    // Get spy credentials
    const { data: spy, error: spyError } = await supabase
      .from('telegram_spies')
      .select('*')
      .eq('id', spy_id)
      .single();

    if (spyError || !spy) {
      return res.status(404).json({ 
        success: false, 
        error: 'Spy not found' 
      });
    }

    if (!spy.is_authorized || !spy.session_string) {
      return res.status(400).json({ 
        success: false, 
        error: 'Spy is not authorized' 
      });
    }

    // Initialize Telegram client
    const client = new TelegramClient(
      new StringSession(spy.session_string),
      parseInt(spy.api_id),
      spy.api_hash,
      { connectionRetries: 3 }
    );

    await client.connect();

    try {
      // Parse channel identifier
      let channelEntity: any;
      
      if (channel_identifier.startsWith('@')) {
        channelEntity = await client.getEntity(channel_identifier);
      } else if (channel_identifier.startsWith('-100')) {
        const channelId = BigInt(channel_identifier);
        channelEntity = await client.getEntity(channelId as any);
      } else if (/^-?\d+$/.test(channel_identifier)) {
        const channelId = BigInt(channel_identifier);
        channelEntity = await client.getEntity(channelId as any);
      } else {
        channelEntity = await client.getEntity(channel_identifier);
      }

      // Leave the channel
      await client.invoke(
        new Api.channels.LeaveChannel({
          channel: channelEntity,
        })
      );

      console.log(`Spy ${spy_id} left channel ${channel_identifier}`);

      return res.status(200).json({ 
        success: true, 
        message: 'Successfully left channel' 
      });

    } catch (error: any) {
      console.error('Error leaving channel:', error);
      
      // If already not a member, consider it success
      if (error.message?.includes('USER_NOT_PARTICIPANT')) {
        return res.status(200).json({ 
          success: true, 
          message: 'Already not a member' 
        });
      }

      throw error;
    } finally {
      await client.disconnect();
    }

  } catch (error: any) {
    console.error('Error in spy-leave-channel:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    });
  }
}
