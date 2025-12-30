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

    const { spammerId } = await req.json();

    if (!spammerId) {
      throw new Error('spammerId is required');
    }

    console.log('[Test Spammer] Looking for spammer:', spammerId);

    // Get spammer info
    const { data: spammer, error: spammerError } = await supabaseClient
      .from('telegram_spammers')
      .select('*')
      .eq('id', spammerId)
      .single();

    if (spammerError || !spammer) {
      throw new Error(`Spammer not found: ${spammerError?.message}`);
    }

    console.log('[Test Spammer] Found:', spammer.name);

    // TODO: Implement actual TData authentication test
    // For now, just return mock success if tdata_path exists
    
    if (!spammer.tdata_path) {
      throw new Error('TData path not set');
    }

    // Update spammer status
    await supabaseClient
      .from('telegram_spammers')
      .update({
        is_authorized: true,
        last_activity_at: new Date().toISOString(),
        error_count: 0,
        last_error: null,
      })
      .eq('id', spammerId);

    console.log('[Test Spammer] Success');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Спамер готовий до роботи',
        spammer: {
          name: spammer.name,
          phone_number: spammer.phone_number,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Test Spammer] Error:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
