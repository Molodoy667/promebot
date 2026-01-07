import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Unified Sync - єдина функція для збору статистики через userbot
 * Об'єднує:
 * 1. Sync stats для bot/ai services (статистика опублікованих постів)
 * 2. Sync source channels (збір нових постів з джерел)
 */

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

    console.log('[Unified Sync] Starting...');

    const results = {
      servicesStats: { synced: 0, skipped: 0, errors: [] as string[] },
      sourcePosts: { synced: 0, skipped: 0, errors: [] as string[] },
    };

    // ============================================
    // ЧАСТИНА 1: Статистика для bot/ai services
    // ============================================
    console.log('[Unified Sync] Part 1: Syncing service stats...');

    const { data: botServices } = await supabaseClient
      .from('bot_services')
      .select('id, target_channel, spy_id');

    const { data: aiServices } = await supabaseClient
      .from('ai_bot_services')
      .select('id, target_channel, spy_id');

    const allServices = [
      ...(botServices || []).map(s => ({ ...s, type: 'plagiarist' as const })),
      ...(aiServices || []).map(s => ({ ...s, type: 'ai' as const }))
    ];

    for (const service of allServices) {
      if (!service.spy_id) {
        results.servicesStats.skipped++;
        continue;
      }

      try {
        const { error } = await supabaseClient.functions.invoke('sync-stats-userbot', {
          body: {
            serviceId: service.id,
            serviceType: service.type,
            spyId: service.spy_id
          }
        });

        if (!error) {
          results.servicesStats.synced++;
          await supabaseClient
            .from(service.type === 'plagiarist' ? 'bot_services' : 'ai_bot_services')
            .update({ last_stats_sync: new Date().toISOString() })
            .eq('id', service.id);
        } else {
          results.servicesStats.errors.push(`${service.id}: ${error.message}`);
        }
      } catch (err: any) {
        results.servicesStats.errors.push(`${service.id}: ${err.message}`);
      }

      // Rate limit: 1 секунда між запитами
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    // ============================================
    // ЧАСТИНА 2: Збір постів з source channels
    // ============================================
    console.log('[Unified Sync] Part 2: Syncing source channels...');

    const { data: sources } = await supabaseClient
      .from('source_channels')
      .select('id, bot_service_id, channel_username, is_private, last_sync_at')
      .eq('is_active', true);

    for (const source of sources || []) {
      // Sync тільки якщо минуло > 30 хвилин
      const lastSync = source.last_sync_at ? new Date(source.last_sync_at) : null;
      if (lastSync) {
        const minutesSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60);
        if (minutesSinceSync < 30) {
          results.sourcePosts.skipped++;
          continue;
        }
      }

      try {
        const syncResponse = await supabaseClient.functions.invoke('sync-source-posts', {
          body: {
            sourceChannelId: source.id,
            botServiceId: source.bot_service_id,
          }
        });

        if (!syncResponse.error) {
          results.sourcePosts.synced++;
        } else {
          results.sourcePosts.errors.push(`${source.id}: ${syncResponse.error.message}`);
        }
      } catch (err: any) {
        results.sourcePosts.errors.push(`${source.id}: ${err.message}`);
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('[Unified Sync] Completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        servicesStats: results.servicesStats,
        sourcePosts: results.sourcePosts,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Unified Sync] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
