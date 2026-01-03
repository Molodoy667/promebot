import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { spy_id, channel_identifier } = await req.json();

    if (!spy_id || !channel_identifier) {
      return new Response(
        JSON.stringify({ error: 'Missing spy_id or channel_identifier' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get spy info
    const { data: spy, error: spyError } = await supabaseClient
      .from('telegram_spies')
      .select('id, session_string, api_id, api_hash')
      .eq('id', spy_id)
      .single();

    if (spyError || !spy) {
      return new Response(
        JSON.stringify({ error: 'Spy not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!spy.session_string || !spy.api_id || !spy.api_hash) {
      return new Response(
        JSON.stringify({ error: 'Spy not authorized' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Spy Join Channel] Attempting to join:', channel_identifier);

    // Call Vercel API to join channel
    const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://promobot.store';
    
    const response = await fetch(`${VERCEL_API_URL}/api/spy-join-channel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_string: spy.session_string,
        api_id: spy.api_id,
        api_hash: spy.api_hash,
        channel_identifier: channel_identifier,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Spy Join Channel] API error:', response.status, errorText);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Failed to join channel: ${errorText}` 
        }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Spy Join Channel] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
