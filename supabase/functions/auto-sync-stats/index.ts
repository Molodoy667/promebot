import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

/**
 * Автоматичний гібридний збір статистики
 * Викликається по cron кожні 15 хвилин
 * Збирає дані обома методами (scraping + MTProto) паралельно
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

    console.log('[Auto-Sync] Starting hybrid stats collection...');

    // Get all active services with hybrid method
    const { data: botServices, error: botErr } = await supabaseClient
      .from('bot_services')
      .select('id, target_channel, spy_id, stats_method, is_running')
      .eq('is_running', true)
      .in('stats_method', ['hybrid', 'scraping', 'mtproto']);

    const { data: aiServices, error: aiErr } = await supabaseClient
      .from('ai_bot_services')
      .select('id, target_channel, spy_id, stats_method, is_active')
      .eq('is_active', true)
      .in('stats_method', ['hybrid', 'scraping', 'mtproto']);

    if (botErr || aiErr) {
      throw new Error('Failed to fetch services');
    }

    const allServices = [
      ...(botServices || []).map(s => ({ ...s, type: 'plagiarist' })),
      ...(aiServices || []).map(s => ({ ...s, type: 'ai' }))
    ];

    console.log(`[Auto-Sync] Found ${allServices.length} active services`);

    let scrapingCount = 0;
    let mtprotoCount = 0;
    const errors: string[] = [];

    // Process each service
    for (const service of allServices) {
      try {
        const method = service.stats_method || 'hybrid';
        
        // Scraping (швидкий)
        if (method === 'scraping' || method === 'hybrid') {
          try {
            const { error: scrapingErr } = await supabaseClient.functions.invoke('sync-stats-scraping', {
              body: {
                serviceId: service.id,
                serviceType: service.type
              }
            });
            
            if (!scrapingErr) {
              scrapingCount++;
              await supabaseClient
                .from(service.type === 'plagiarist' ? 'bot_services' : 'ai_bot_services')
                .update({ last_scraping_sync: new Date().toISOString() })
                .eq('id', service.id);
            } else {
              errors.push(`Scraping ${service.id}: ${scrapingErr.message}`);
            }
          } catch (err: any) {
            errors.push(`Scraping ${service.id}: ${err.message}`);
          }
        }

        // MTProto (точний, якщо є шпигун)
        if ((method === 'mtproto' || method === 'hybrid') && service.spy_id) {
          try {
            const { error: mtprotoErr } = await supabaseClient.functions.invoke('sync-stats-userbot', {
              body: {
                serviceId: service.id,
                serviceType: service.type,
                spyId: service.spy_id
              }
            });
            
            if (!mtprotoErr) {
              mtprotoCount++;
              await supabaseClient
                .from(service.type === 'plagiarist' ? 'bot_services' : 'ai_bot_services')
                .update({ last_mtproto_sync: new Date().toISOString() })
                .eq('id', service.id);
            } else {
              errors.push(`MTProto ${service.id}: ${mtprotoErr.message}`);
            }
          } catch (err: any) {
            errors.push(`MTProto ${service.id}: ${err.message}`);
          }
        }

        // Small delay between services
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (err: any) {
        errors.push(`Service ${service.id}: ${err.message}`);
      }
    }

    console.log(`[Auto-Sync] Completed: ${scrapingCount} scraping, ${mtprotoCount} MTProto`);
    if (errors.length > 0) {
      console.error(`[Auto-Sync] Errors:`, errors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        services: allServices.length,
        scrapingCount,
        mtprotoCount,
        errors: errors.slice(0, 10), // Показуємо max 10 помилок
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
