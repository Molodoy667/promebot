import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Sync Source Posts
 * Читає пости з джерельних каналів:
 * - Публічні канали → через бота
 * - Приватні канали → через спамера
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

    const { sourceChannelId, botServiceId } = await req.json();

    console.log('[Sync Source Posts] Starting sync for:', sourceChannelId);

    // Get source channel info
    const { data: sourceChannel, error: channelError } = await supabaseClient
      .from('source_channels')
      .select('*')
      .eq('id', sourceChannelId)
      .single();

    if (channelError || !sourceChannel) {
      throw new Error('Source channel not found');
    }

    // Get bot service info
    const { data: botService, error: serviceError } = await supabaseClient
      .from('telegram_bots')
      .select('bot_token')
      .eq('id', botServiceId)
      .single();

    if (serviceError || !botService) {
      throw new Error('Bot service not found');
    }

    let posts = [];

    if (sourceChannel.is_private) {
      // Private channel - use spammer
      console.log('[Sync Source Posts] Private channel, using spammer...');

      if (!sourceChannel.spammer_id) {
        throw new Error('No spammer assigned to private channel');
      }

      const { data: spammer } = await supabaseClient
        .from('telegram_spammers')
        .select('*')
        .eq('id', sourceChannel.spammer_id)
        .single();

      if (!spammer || !spammer.is_authorized) {
        throw new Error('Spammer not authorized');
      }

      // TODO: Use spammer TData to read channel messages
      // For now, mock response
      console.log('[Sync Source Posts] Using spammer:', spammer.name);
      
      posts = [{
        channel_id: sourceChannel.id,
        message_id: Date.now(),
        text: 'Mock post from private channel',
        media_url: null,
        posted_at: new Date().toISOString(),
      }];

    } else {
      // Public channel - use bot
      console.log('[Sync Source Posts] Public channel, using bot...');

      try {
        // Get channel info first
        const chatResponse = await fetch(
          `https://api.telegram.org/bot${botService.bot_token}/getChat?chat_id=@${sourceChannel.channel_username}`
        );

        const chatData = await chatResponse.json();
        
        if (!chatData.ok) {
          throw new Error(chatData.description || 'Failed to get chat');
        }

        const chatId = chatData.result.id;

        // Get recent messages (via getUpdates or using channel ID)
        // Note: For channels, we need to use different approach
        // This is simplified - in production you'd need to implement proper message fetching

        console.log('[Sync Source Posts] Bot connected to channel:', chatData.result.title);

        // Mock posts for now
        posts = [{
          channel_id: sourceChannel.id,
          message_id: Date.now(),
          text: `Post from ${chatData.result.title}`,
          media_url: null,
          posted_at: new Date().toISOString(),
        }];

      } catch (error: any) {
        throw new Error(`Bot failed to read channel: ${error.message}`);
      }
    }

    // Save posts to database
    if (posts.length > 0) {
      // TODO: Save to a posts table
      console.log(`[Sync Source Posts] Found ${posts.length} posts`);
    }

    // Update last_sync_at
    await supabaseClient
      .from('source_channels')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('id', sourceChannelId);

    return new Response(
      JSON.stringify({
        success: true,
        postsFound: posts.length,
        channelType: sourceChannel.is_private ? 'private' : 'public',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Sync Source Posts] Error:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
