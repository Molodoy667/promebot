import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { serviceId, serviceType } = await req.json();

    if (!serviceId || !serviceType) {
      throw new Error('serviceId and serviceType are required');
    }

    console.log(`[Scraping] Syncing stats for ${serviceType} service ${serviceId}`);

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
        JSON.stringify({ message: 'No posts to sync', updated: 0, total: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${posts.length} posts to sync from @${channelUsername}`);

    // Get channel subscribers count
    let subscribersCount: number | null = null;
    try {
      subscribersCount = await getChannelSubscribersCount(channelUsername);
      console.log(`Channel @${channelUsername} has ${subscribersCount} subscribers`);
    } catch (error: any) {
      console.error(`Failed to get subscribers count: ${error.message}`);
    }

    let updatedCount = 0;
    const errors: string[] = [];

    // Use Telegram's public API to scrape channel stats
    // This works without authentication for public channels
    for (const post of posts) {
      try {
        const stats = await getChannelPostStats(channelUsername, post.message_id);
        
        if (stats !== null) {
          const { error: updateError } = await supabaseClient
            .from(postsTable)
            .update({
              views: stats.views,
              reactions: stats.reactions,
            })
            .eq('id', post.id);

          if (updateError) {
            errors.push(`Post ${post.id}: ${updateError.message}`);
          } else {
            updatedCount++;
            console.log(`Updated post ${post.message_id}: ${stats.views} views, ${stats.reactions} reactions`);
          }
        }
      } catch (error: any) {
        errors.push(`Post ${post.id}: ${error.message}`);
      }
    }

    console.log(`Successfully updated ${updatedCount}/${posts.length} posts`);
    if (errors.length > 0) {
      console.error('Errors:', errors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        updated: updatedCount,
        total: posts.length,
        subscribersCount: subscribersCount,
        errors: errors.length > 0 ? errors.slice(0, 5) : undefined, // Show max 5 errors
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error syncing stats:', error);
    return new Response(
      JSON.stringify({ error: error.message, updated: 0, total: 0 }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

async function getChannelPostStats(channelUsername: string, messageId: number): Promise<{ views: number; reactions: number } | null> {
  try {
    // Use Telegram's web preview API (public, no auth needed)
    // This endpoint returns HTML that contains post stats
    const url = `https://t.me/${channelUsername}/${messageId}?embed=1&mode=tme`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch post: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Debug: log HTML snippet for reactions analysis
    const reactionSnippet = html.substring(html.indexOf('reaction'), html.indexOf('reaction') + 500);
    if (html.includes('reaction')) {
      console.log(`HTML snippet with 'reaction' for ${channelUsername}/${messageId}:`, reactionSnippet);
    } else {
      console.log(`No 'reaction' text found in HTML for ${channelUsername}/${messageId}`);
    }
    
    // Parse views from HTML
    // Format: <span class="tgme_widget_message_views">1.2K</span>
    const viewsMatch = html.match(/tgme_widget_message_views[^>]*>([^<]+)</i);
    const views = viewsMatch ? parseViewCount(viewsMatch[1]) : 0;
    
    // Parse reactions from HTML - try multiple patterns
    // Pattern 1: <span class="tgme_widget_message_reaction_count">5</span>
    // Pattern 2: data-reaction-count="5"
    let reactions = 0;
    const reactionsList: string[] = [];
    
    // Try pattern 1 - span with class
    const reactionsMatches1 = html.matchAll(/tgme_widget_message_reaction_count[^>]*>([^<]+)</gi);
    for (const match of reactionsMatches1) {
      const count = parseViewCount(match[1]);
      reactions += count;
      reactionsList.push(`span:${match[1]}=${count}`);
    }
    
    // Try pattern 2 - data attribute
    if (reactions === 0) {
      const reactionsMatches2 = html.matchAll(/data-reaction-count=["']([^"']+)["']/gi);
      for (const match of reactionsMatches2) {
        const count = parseViewCount(match[1]);
        reactions += count;
        reactionsList.push(`data:${match[1]}=${count}`);
      }
    }
    
    // Try pattern 3 - reactions counter in different format
    if (reactions === 0) {
      const reactionsMatches3 = html.matchAll(/class=["'].*?reaction.*?count.*?["'][^>]*>(\d+)</gi);
      for (const match of reactionsMatches3) {
        const count = parseViewCount(match[1]);
        reactions += count;
        reactionsList.push(`class:${match[1]}=${count}`);
      }
    }

    console.log(`Parsed stats for ${channelUsername}/${messageId}: ${views} views, ${reactions} reactions [${reactionsList.join(', ')}]`);
    
    return { views, reactions };
  } catch (error: any) {
    console.error(`Error getting stats for message ${messageId}:`, error.message);
    return null;
  }
}

async function getChannelSubscribersCount(channelUsername: string): Promise<number | null> {
  try {
    // Use Telegram's web preview API
    const url = `https://t.me/${channelUsername}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      console.error(`Failed to fetch channel: ${response.status}`);
      return null;
    }

    const html = await response.text();
    
    // Debug: log HTML snippet with 'subscriber'
    const subscriberSnippet = html.substring(html.indexOf('subscriber') - 100, html.indexOf('subscriber') + 200);
    if (html.includes('subscriber')) {
      console.log(`HTML snippet with 'subscriber' for @${channelUsername}:`, subscriberSnippet);
    } else {
      console.log(`No 'subscriber' text found in HTML for @${channelUsername}`);
    }
    
    // Parse subscribers from HTML - try multiple patterns
    // Pattern 1: <div class="tgme_page_extra">123 456 subscribers</div>
    let subscribersMatch = html.match(/tgme_page_extra[^>]*>([^<]*?)([\d\s.,KM]+)\s*subscriber/i);
    
    if (subscribersMatch && subscribersMatch[2]) {
      const count = parseViewCount(subscribersMatch[2]);
      console.log(`Parsed subscribers (pattern 1) for @${channelUsername}: ${subscribersMatch[2]} -> ${count}`);
      return count;
    }
    
    // Pattern 2: Simple number before "subscribers"
    subscribersMatch = html.match(/([\d\s.,KM]+)\s*subscribers/i);
    
    if (subscribersMatch && subscribersMatch[1]) {
      const count = parseViewCount(subscribersMatch[1]);
      console.log(`Parsed subscribers (pattern 2) for @${channelUsername}: ${subscribersMatch[1]} -> ${count}`);
      return count;
    }
    
    console.log(`No subscribers info found for @${channelUsername}`);
    return null;
  } catch (error: any) {
    console.error(`Error getting subscribers count: ${error.message}`);
    return null;
  }
}

function parseViewCount(viewStr: string): number {
  // Parse "1.2K" -> 1200, "5.3M" -> 5300000
  viewStr = viewStr.trim().toUpperCase();
  
  if (viewStr.endsWith('K')) {
    return Math.round(parseFloat(viewStr.slice(0, -1)) * 1000);
  } else if (viewStr.endsWith('M')) {
    return Math.round(parseFloat(viewStr.slice(0, -1)) * 1000000);
  } else {
    return parseInt(viewStr.replace(/[^\d]/g, '')) || 0;
  }
}
