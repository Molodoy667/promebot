import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Автоматичний збір статистики через MTProto (юзербот)
 * Викликається по cron кожні 5 хвилин
 * Збирає точні дані з Telegram API
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

    console.log('[Auto-Sync] Starting MTProto stats collection...');

    // Get all active services with hybrid method
    const { data: botServices, error: botErr } = await supabaseClient
      .from('bot_services')
      .select('id, target_channel, spy_id');

    const { data: aiServices, error: aiErr } = await supabaseClient
      .from('ai_bot_services')
      .select('id, target_channel, spy_id');

    if (botErr || aiErr) {
      throw new Error('Failed to fetch services');
    }

    const allServices = [
      ...(botServices || []).map(s => ({ ...s, type: 'plagiarist' })),
      ...(aiServices || []).map(s => ({ ...s, type: 'ai' }))
    ];

    console.log(`[Auto-Sync] Found ${allServices.length} services`);

    let successCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];

    // Process each service - MTProto only
    for (const service of allServices) {
      try {
        // Skip if no spy_id (no userbot connected)
        if (!service.spy_id) {
          skippedCount++;
          console.log(`[Auto-Sync] Skipping ${service.id} - no spy_id`);
          continue;
        }

        // MTProto through userbot
        try {
          const { error: mtprotoErr } = await supabaseClient.functions.invoke('sync-stats-userbot', {
            body: {
              serviceId: service.id,
              serviceType: service.type,
              spyId: service.spy_id
            }
          });
          
          if (!mtprotoErr) {
            successCount++;
            await supabaseClient
              .from(service.type === 'plagiarist' ? 'bot_services' : 'ai_bot_services')
              .update({ last_mtproto_sync: new Date().toISOString() })
              .eq('id', service.id);
          } else {
            errors.push(`${service.id}: ${mtprotoErr.message}`);
          }
        } catch (err: any) {
          errors.push(`${service.id}: ${err.message}`);
        }

        // Small delay between services
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err: any) {
        errors.push(`${service.id}: ${err.message}`);
      }
    }

    console.log(`[Auto-Sync] Completed: ${successCount} synced, ${skippedCount} skipped (no userbot)`);
    if (errors.length > 0) {
      console.error(`[Auto-Sync] Errors:`, errors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        services: allServices.length,
        synced: successCount,
        skipped: skippedCount,
        errors: errors.slice(0, 10),
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Auto-Sync] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
