import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verify Source Channel
 * Перевіряє канал і визначає тип (публічний/приватний)
 * Для публічних - підключає бота
 * Для приватних - підключає спамера
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      channel_input, 
      channel_identifier, 
      is_private, 
      invite_hash, 
      bot_token,
      service_id 
    } = await req.json();

    console.log('[Verify Source Channel] Input:', channel_input);
    console.log('[Verify Source Channel] Type:', is_private ? 'private' : 'public');

    let channelInfo = null;

    if (is_private) {
      // Private channel - need spammer to join and read
      console.log('[Verify Source Channel] Private channel detected, using spammer...');

      // Get active spammer from admin settings
      const { data: spammer, error: spammerError } = await supabaseClient
        .from('telegram_spammers')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (spammerError || !spammer) {
        throw new Error('Активного спамера не знайдено. Додайте спамера в адмін-панелі.');
      }

      console.log('[Verify Source Channel] Using spammer:', spammer.id);

      // Read private channel via spammer
      const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://promobot.store';
      
      const response = await fetch(`${VERCEL_API_URL}/api/read-channel-messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'read_messages',
          tdataPath: spammer.tdata_path,
          channelIdentifier: invite_hash ? `+${invite_hash}` : channel_input,
          limit: 1,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Не вдалося підключитись: ${errorText}`);
      }

      const data = await response.json();

      if (!data.success || !data.channelInfo) {
        throw new Error(data.error || 'Не вдалося отримати інфо про канал');
      }

      channelInfo = {
        id: data.channelInfo.id,
        title: data.channelInfo.title || '🔒 Приватний канал',
        type: 'channel',
        username: data.channelInfo.username || null,
        isPrivate: true,
        spammerId: spammer.id,
        photo_url: data.channelInfo.photo_url || null,
        members_count: data.channelInfo.members_count || null,
      };

      console.log('[Verify Source Channel] Got channel info:', channelInfo.title);

    } else {
      // Public channel - verify with bot
      console.log('[Verify Source Channel] Public channel, using bot...');

      try {
        const response = await fetch(
          `https://api.telegram.org/bot${bot_token}/getChat?chat_id=${channel_input}`
        );

        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.description || 'Не вдалося знайти канал');
        }

        channelInfo = {
          id: data.result.id,
          title: data.result.title,
          username: data.result.username,
          type: data.result.type,
          isPrivate: false,
        };

        console.log('[Verify Source Channel] Bot verified channel:', channelInfo.title);

      } catch (error: any) {
        throw new Error(`Не вдалося підключитись до каналу: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        channelInfo,
        isPrivate: is_private,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Verify Source Channel] Error:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
