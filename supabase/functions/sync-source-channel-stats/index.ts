import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Збір статистики для конкретного source_channel через юзербота
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://promobot.store';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { sourceChannelId, channelIdentifier, spyId } = await req.json();

    if (!sourceChannelId) {
      throw new Error('sourceChannelId is required');
    }

    console.log(`[Source Stats] Syncing stats for source channel ${sourceChannelId}`);

    // Get source channel info
    const { data: sourceChannel, error: channelError } = await supabaseClient
      .from('source_channels')
      .select('*, bot_services!inner(user_id)')
      .eq('id', sourceChannelId)
      .single();

    if (channelError || !sourceChannel) {
      throw new Error('Source channel not found');
    }

    const finalSpyId = spyId || sourceChannel.spy_id;
    const finalChannelId = channelIdentifier || sourceChannel.channel_username;

    if (!finalSpyId) {
      throw new Error('No spy available for this source channel');
    }

    // Get spy credentials
    const { data: spy, error: spyError } = await supabaseClient
      .from('telegram_spies')
      .select('*')
      .eq('id', finalSpyId)
      .eq('is_active', true)
      .single();

    if (spyError || !spy) {
      throw new Error('Spy not found or inactive');
    }

    if (!spy.session_string || !spy.api_id || !spy.api_hash) {
      throw new Error('Spy not authorized');
    }

    console.log(`[Source Stats] Getting channel info for ${finalChannelId}`);

    // Get channel info and recent messages via MTProto
    const response = await fetch(`${VERCEL_API_URL}/api/spy-get-channel-info`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_string: spy.session_string,
        api_id: spy.api_id,
        api_hash: spy.api_hash,
        channel_identifier: finalChannelId,
        limit: 50, // Останні 50 постів для статистики
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to get channel info: ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to get channel stats');
    }

    console.log(`[Source Stats] Got channel info:`, {
      title: data.channelInfo?.title,
      membersCount: data.channelInfo?.participantsCount,
      messagesCount: data.messages?.length
    });

    // Update source channel with latest info
    const updateData: any = {
      last_sync_at: new Date().toISOString(),
    };

    if (data.channelInfo?.title) {
      updateData.channel_title = data.channelInfo.title;
    }

    await supabaseClient
      .from('source_channels')
      .update(updateData)
      .eq('id', sourceChannelId);

    // Return channel stats
    return new Response(
      JSON.stringify({
        success: true,
        channelInfo: data.channelInfo,
        stats: {
          title: data.channelInfo?.title,
          membersCount: data.channelInfo?.participantsCount || 0,
          messagesCount: data.messages?.length || 0,
          lastSync: new Date().toISOString(),
        },
        messages: data.messages || [],
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Source Stats] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
