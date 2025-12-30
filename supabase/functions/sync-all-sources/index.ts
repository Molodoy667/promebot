import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Sync All Sources
 * Worker that syncs all active source channels
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('[Sync All Sources] Starting...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all active source channels
    const { data: sources, error: sourcesError } = await supabaseClient
      .from('source_channels')
      .select('id, bot_service_id, channel_username, is_private, last_sync_at')
      .eq('is_active', true);

    if (sourcesError) {
      throw sourcesError;
    }

    console.log(`[Sync All Sources] Found ${sources?.length || 0} active sources`);

    let syncedCount = 0;
    let failedCount = 0;

    for (const source of sources || []) {
      try {
        // Check if needs sync (more than 30 minutes since last sync)
        const lastSync = source.last_sync_at ? new Date(source.last_sync_at) : null;
        const now = new Date();
        
        if (lastSync) {
          const minutesSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60);
          if (minutesSinceSync < 30) {
            console.log(`[Sync All Sources] Source ${source.id} synced recently, skipping`);
            continue;
          }
        }

        console.log(`[Sync All Sources] Syncing source ${source.id}...`);

        // Call sync-source-posts
        const syncResponse = await fetch(
          `${Deno.env.get('SUPABASE_URL')}/functions/v1/sync-source-posts`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
            },
            body: JSON.stringify({
              sourceChannelId: source.id,
              botServiceId: source.bot_service_id,
            }),
          }
        );

        if (syncResponse.ok) {
          syncedCount++;
          const syncData = await syncResponse.json();
          console.log(`[Sync All Sources] Synced ${source.id}: ${syncData.postsSaved || 0} posts`);
        } else {
          failedCount++;
          const errorText = await syncResponse.text();
          console.error(`[Sync All Sources] Failed to sync ${source.id}:`, errorText);
        }

      } catch (error) {
        failedCount++;
        console.error(`[Sync All Sources] Error syncing ${source.id}:`, error);
      }
    }

    console.log(`[Sync All Sources] Completed: ${syncedCount} synced, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        totalSources: sources?.length || 0,
        synced: syncedCount,
        failed: failedCount,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Sync All Sources] Error:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
