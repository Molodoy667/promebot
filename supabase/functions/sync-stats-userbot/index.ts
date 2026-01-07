import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// MTProto через Vercel API (Node.js + GramJS)
const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://promobot.store';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UserbotStats {
  views: number;
  forwards: number;
  reactions: number;
  editDate?: string;
  postDate: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { serviceId, serviceType, spyId } = await req.json();

    if (!serviceId || !serviceType || !spyId) {
      throw new Error('serviceId, serviceType, and spyId are required');
    }

    console.log(`[MTProto] Syncing stats for ${serviceType} service ${serviceId} using spy ${spyId}`);

    // Get spy credentials
    const { data: spy, error: spyError } = await supabaseClient
      .from('telegram_spies')
      .select('*')
      .eq('id', spyId)
      .eq('is_active', true)
      .single();

    if (spyError || !spy) {
      throw new Error('Spy not found or inactive');
    }

    // Get service info
    const serviceTable = serviceType === 'plagiarist' ? 'bot_services' : 'ai_bot_services';
    const { data: service, error: serviceError } = await supabaseClient
      .from(serviceTable)
      .select('target_channel')
      .eq('id', serviceId)
      .single();

    if (serviceError || !service) {
      throw new Error('Service not found');
    }

    const channelUsername = service.target_channel?.replace('@', '');
    
    if (!channelUsername) {
      throw new Error('Channel username not configured');
    }

    // Get posts that need stats update
    const postsTable = serviceType === 'plagiarist' ? 'posts_history' : 'ai_generated_posts';
    const idField = serviceType === 'plagiarist' ? 'bot_service_id' : 'ai_bot_service_id';
    
    const { data: posts, error: postsError } = await supabaseClient
      .from(postsTable)
      .select('id, message_id, created_at')
      .eq(idField, serviceId)
      .not('message_id', 'is', null)
      .in('status', ['published', 'success'])
      .order('created_at', { ascending: false })
      .limit(50);

    if (postsError) {
      throw new Error(`Error fetching posts: ${postsError.message}`);
    }

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'No posts to sync', 
          updated: 0, 
          total: 0,
          method: 'mtproto'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[MTProto] Found ${posts.length} posts to sync from @${channelUsername}`);

    // TODO: Implement real MTProto connection with GramJS
    // For now, simulate with enhanced data
    let updatedCount = 0;
    const errors: string[] = [];

    // Batch collect stats for all posts
    const messageIds = posts.map(p => p.message_id);
    const { channelInfo, stats: statsMap } = await getMTProtoPostsStats(channelUsername, messageIds, spy);

    if (channelInfo) {
      console.log(`[MTProto] Channel @${channelUsername}: ${channelInfo.participantsCount} members`);
    }

    // Update each post
    for (const post of posts) {
      try {
        const stats = statsMap.get(post.message_id);
        
        if (stats) {
          const mtprotoStats = {
            views: stats.views,
            forwards: stats.forwards,
            reactions: stats.reactions,
            timestamp: new Date().toISOString(),
            method: 'mtproto',
            channelInfo: channelInfo ? {
              participantsCount: channelInfo.participantsCount,
              title: channelInfo.title
            } : null
          };

          const { error: updateError } = await supabaseClient
            .from(postsTable)
            .update({
              views: stats.views,
              reactions: stats.reactions,
              mtproto_stats: mtprotoStats,
            })
            .eq('id', post.id);

          if (updateError) {
            errors.push(`Post ${post.id}: ${updateError.message}`);
          } else {
            updatedCount++;
            console.log(`[MTProto] Updated post ${post.message_id}: ${stats.views} views, ${stats.forwards} forwards, ${stats.reactions} reactions`);
          }
        }
      } catch (error: any) {
        errors.push(`Post ${post.id}: ${error.message}`);
      }
    }

    // Update service last sync time
    await supabaseClient
      .from(serviceTable)
      .update({ last_stats_sync: new Date().toISOString() })
      .eq('id', serviceId);

    // Save channel info to spy
    if (channelInfo) {
      await supabaseClient
        .from('telegram_spies')
        .update({
          channel_info: {
            title: channelInfo.title,
            username: channelInfo.username || channelUsername,
            photo: channelInfo.photo || null,
            isPrivate: channelInfo.broadcast === false,
            participantsCount: channelInfo.participantsCount || 0,
            membersCount: channelInfo.participantsCount || 0,
          }
        })
        .eq('id', spyId);
      
      console.log(`[MTProto] Saved channel info to spy: ${channelInfo.title}`);
    }

    // Save to channel_stats_history (оновлюємо сьогоднішній запис або створюємо новий)
    if (channelInfo) {
      const totalViews = Array.from(statsMap.values()).reduce((sum, s) => sum + s.views, 0);
      const totalReactions = Array.from(statsMap.values()).reduce((sum, s) => sum + s.reactions, 0);
      
      // Перевіряємо чи є запис за сьогодні
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const { data: existingRecord } = await supabaseClient
        .from('channel_stats_history')
        .select('id')
        .eq('service_id', serviceId)
        .eq('service_type', serviceType)
        .gte('recorded_at', today.toISOString())
        .lt('recorded_at', tomorrow.toISOString())
        .single();
      
      if (existingRecord) {
        // Оновлюємо існуючий запис
        await supabaseClient
          .from('channel_stats_history')
          .update({
            subscribers_count: channelInfo.participantsCount,
            total_views: totalViews,
            total_reactions: totalReactions,
            recorded_at: new Date().toISOString()
          })
          .eq('id', existingRecord.id);
        
        console.log(`[MTProto] Updated today's stats: ${channelInfo.participantsCount} subs, ${totalViews} views, ${totalReactions} reactions`);
      } else {
        // Створюємо новий запис
        await supabaseClient
          .from('channel_stats_history')
          .insert({
            service_id: serviceId,
            service_type: serviceType,
            channel_name: channelInfo.title || channelUsername,
            subscribers_count: channelInfo.participantsCount,
            total_views: totalViews,
            total_reactions: totalReactions,
            recorded_at: new Date().toISOString()
          });
        
        console.log(`[MTProto] Created new stats record: ${channelInfo.participantsCount} subs, ${totalViews} views, ${totalReactions} reactions`);
      }
    }

    console.log(`[MTProto] Successfully updated ${updatedCount}/${posts.length} posts`);
    
    return new Response(
      JSON.stringify({
        success: true,
        method: 'mtproto',
        updated: updatedCount,
        total: posts.length,
        channelInfo: channelInfo,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[MTProto] Error syncing stats:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message, 
        method: 'mtproto',
        updated: 0, 
        total: 0 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Get channel info via Vercel API
async function getMTProtoChannelInfo(username: string, spy: any): Promise<any> {
  console.log(`[MTProto] Getting channel info for @${username} via Vercel API`);
  
  try {
    // We'll get it together with stats to save requests
    return null;
  } catch (error: any) {
    console.error(`[MTProto] Error:`, error.message);
    return null;
  }
}

// Get posts stats via Vercel API (batch request)
async function getMTProtoPostsStats(username: string, messageIds: number[], spy: any): Promise<{channelInfo: any, stats: Map<number, UserbotStats>}> {
  console.log(`[MTProto] Getting stats for @${username}, ${messageIds.length} posts via Vercel API`);
  
  try {
    // First, get channel info using spy-get-channel-info
    let channelInfo = null;
    try {
      const infoResponse = await fetch(`${VERCEL_API_URL}/api/spy-get-channel-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_string: spy.session_string,
          api_id: spy.api_id,
          api_hash: spy.api_hash,
          channel_identifier: username,
        }),
      });

      if (infoResponse.ok) {
        const infoData = await infoResponse.json();
        if (infoData.success && infoData.channelInfo) {
          channelInfo = {
            title: infoData.channelInfo.title,
            participantsCount: infoData.channelInfo.members_count || 0,
            username: infoData.channelInfo.username || username,
          };
          console.log(`[MTProto] Channel info: ${channelInfo.participantsCount} subscribers`);
        }
      } else {
        console.warn(`[MTProto] spy-get-channel-info failed: ${infoResponse.status}`);
      }
    } catch (infoError: any) {
      console.warn(`[MTProto] Failed to get channel info:`, infoError.message);
    }

    // Then get posts stats using spy-read-channel (more reliable)
    const statsMap = new Map<number, UserbotStats>();
    
    try {
      const response = await fetch(`${VERCEL_API_URL}/api/spy-read-channel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_string: spy.session_string,
          api_id: spy.api_id,
          api_hash: spy.api_hash,
          channel_identifier: username,
          limit: 100, // Get last 100 messages
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.success && data.messages) {
          console.log(`[MTProto] Read ${data.messages.length} messages from channel`);
          
          // Map messages to stats by ID
          data.messages.forEach((msg: any) => {
            if (messageIds.includes(msg.id)) {
              statsMap.set(msg.id, {
                views: msg.views || 0,
                forwards: msg.forwards || 0,
                reactions: msg.reactions || 0,
                postDate: msg.date,
              });
            }
          });
          
          console.log(`[MTProto] Matched ${statsMap.size}/${messageIds.length} posts`);
        }
      } else {
        console.warn(`[MTProto] spy-read-channel failed: ${response.status}`);
      }
    } catch (statsError: any) {
      console.warn(`[MTProto] Failed to get posts stats:`, statsError.message);
    }

    return {
      channelInfo,
      stats: statsMap,
    };
  } catch (error: any) {
    console.error(`[MTProto] Error:`, error.message);
    return { channelInfo: null, stats: new Map() };
  }
}
