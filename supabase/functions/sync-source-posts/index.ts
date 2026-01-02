import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Sync Source Posts
 * Читає пости з джерельних каналів:
 * - Публічні канали → через бота (Bot API) - обмежений функціонал
 * - Приватні канали → через шпигуна (userbot MTProto) - повний доступ
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
      // Private channel - use spy (userbot) via MTProto
      console.log('[Sync Source Posts] Private channel, using spy (userbot)...');

      if (!sourceChannel.spy_id) {
        throw new Error('No spy (userbot) assigned to private channel');
      }

      // Get spy info with API credentials
      const { data: spy } = await supabaseClient
        .from('telegram_spies')
        .select('id, session_string, api_id, api_hash')
        .eq('id', sourceChannel.spy_id)
        .single();

      if (!spy || !spy.session_string) {
        throw new Error('Spy not available or not authorized');
      }

      // Read private channel via spy MTProto
      const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://promobot.store';
      
      const readResponse = await fetch(`${VERCEL_API_URL}/api/spy-read-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_string: spy.session_string,
          api_id: spy.api_id,
          api_hash: spy.api_hash,
          channel_identifier: sourceChannel.invite_hash 
            ? `+${sourceChannel.invite_hash}` 
            : sourceChannel.channel_username,
          limit: 20,
        })
      });

      if (!readResponse.ok) {
        const errorText = await readResponse.text();
        throw new Error(`Failed to read private channel via spy: ${errorText}`);
      }

      const readData = await readResponse.json();

      if (!readData.success) {
        throw new Error(readData.error || 'Failed to read messages');
      }

      console.log(`[Sync Source Posts] Spy read ${readData.messages?.length || 0} messages from private channel`);

      // Convert messages to posts format
      posts = (readData.messages || []).map((msg: any) => ({
        message_id: msg.id,
        text: msg.text || '',
        media_url: msg.media?.url || null,
        media_type: msg.media?.type || null,
        views_count: msg.views || 0,
        forwards_count: msg.forwards || 0,
        posted_at: msg.date,
      }));

    } else {
      // Public channel - use bot (Bot API has limited functionality)
      console.log('[Sync Source Posts] Public channel, using bot...');

      try {
        // Get channel info
        const chatResponse = await fetch(
          `https://api.telegram.org/bot${botService.bot_token}/getChat?chat_id=@${sourceChannel.channel_username}`
        );

        const chatData = await chatResponse.json();
        
        if (!chatData.ok) {
          throw new Error(chatData.description || 'Failed to get chat');
        }

        console.log('[Sync Source Posts] Bot connected to public channel:', chatData.result.title);

        // Note: Bot API cannot read channel messages directly
        // Bot can only post, not read history from channels
        // For reading public channel posts, you would need:
        // 1. Channel forwarding to a group where bot is admin
        // 2. Or use userbot/spy with MTProto
        
        posts = [];
        console.log('[Sync Source Posts] Note: Bot cannot read public channel posts via Bot API');
        console.log('[Sync Source Posts] Consider using channel->group forwarding or userbot for full sync');

      } catch (error: any) {
        throw new Error(`Bot failed to connect: ${error.message}`);
      }
    }

    // Save posts to database
    let savedCount = 0;
    
    if (posts.length > 0) {
      console.log(`[Sync Source Posts] Saving ${posts.length} posts to database...`);
      
      for (const post of posts) {
        try {
          const { error: insertError } = await supabaseClient
            .from('source_posts')
            .insert({
              source_channel_id: sourceChannelId,
              bot_service_id: botServiceId,
              original_message_id: post.message_id,
              text: post.text,
              media_url: post.media_url,
              media_type: post.media_type || null,
              has_media: !!post.media_url,
              author_name: post.author_name || null,
              views_count: post.views_count || 0,
              forwards_count: post.forwards_count || 0,
              posted_at: post.posted_at,
              is_processed: false,
              is_published: false,
            })
            .select()
            .single();

          if (!insertError) {
            savedCount++;
          } else if (insertError.code === '23505') {
            // Duplicate - skip
            console.log(`[Sync Source Posts] Post ${post.message_id} already exists, skipping`);
          } else {
            console.error(`[Sync Source Posts] Error saving post:`, insertError);
          }
        } catch (err) {
          console.error(`[Sync Source Posts] Failed to save post:`, err);
        }
      }
      
      console.log(`[Sync Source Posts] Saved ${savedCount}/${posts.length} posts`);
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
        postsSaved: savedCount,
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
