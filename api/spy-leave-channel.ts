import type { VercelRequest, VercelResponse } from '@vercel/node';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const apiId = parseInt(process.env.TELEGRAM_API_ID || '0');
const apiHash = process.env.TELEGRAM_API_HASH || '';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { spy_id, channel_id } = req.body;

    if (!spy_id || !channel_id) {
      return res.status(400).json({
        success: false,
        error: 'spy_id and channel_id are required'
      });
    }

    console.log('[Spy Leave Channel] Starting leave process:', { spy_id, channel_id });

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get spy session
    const { data: spy, error: spyError } = await supabase
      .from('telegram_spies')
      .select('session_string')
      .eq('id', spy_id)
      .single();

    if (spyError || !spy) {
      console.error('[Spy Leave Channel] Spy not found:', spyError);
      return res.status(404).json({
        success: false,
        error: 'Spy not found'
      });
    }

    // Initialize Telegram client
    const session = new StringSession(spy.session_string);
    const client = new TelegramClient(session, apiId, apiHash, {
      connectionRetries: 5,
    });

    await client.connect();
    console.log('[Spy Leave Channel] Client connected');

    try {
      // Try to get entity and leave
      const entity = await client.getEntity(channel_id);
      
      if (entity.className === 'Channel') {
        // Delete channel (leave)
        await client.invoke(
          new (await import('telegram/tl')).Api.channels.LeaveChannel({
            channel: entity,
          })
        );
        console.log('[Spy Leave Channel] Successfully left channel');
      } else {
        console.log('[Spy Leave Channel] Not a channel, skipping leave');
      }
    } catch (leaveErr: any) {
      console.error('[Spy Leave Channel] Error leaving:', leaveErr.message);
      // Continue even if leave fails - channel might be already left or deleted
    }

    await client.disconnect();

    return res.status(200).json({
      success: true,
      message: 'Successfully left channel'
    });

  } catch (error: any) {
    console.error('[Spy Leave Channel] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
}
