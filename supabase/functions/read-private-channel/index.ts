import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Read Private Channel via Spammer TData
 * Uses Vercel API to execute TData reading
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

    const { spammerId, channelIdentifier, inviteHash, limit = 10 } = await req.json();

    console.log('[Read Private Channel] Spammer:', spammerId);
    console.log('[Read Private Channel] Channel:', channelIdentifier);

    // Get spammer info
    const { data: spammer, error: spammerError } = await supabaseClient
      .from('telegram_spammers')
      .select('*')
      .eq('id', spammerId)
      .single();

    if (spammerError || !spammer) {
      throw new Error('Spammer not found');
    }

    if (!spammer.is_authorized || !spammer.tdata_path) {
      throw new Error('Spammer not authorized or TData missing');
    }

    console.log('[Read Private Channel] Using spammer:', spammer.name);

    // Call Vercel API to read messages via TData
    const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://promobot.store';
    
    const response = await fetch(`${VERCEL_API_URL}/api/read-channel-messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'read_messages',
        tdataPath: spammer.tdata_path,
        channelIdentifier: inviteHash ? `+${inviteHash}` : channelIdentifier,
        limit: limit,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Vercel API error: ${errorText}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || 'Failed to read messages');
    }

    console.log(`[Read Private Channel] Read ${data.messages?.length || 0} messages`);

    return new Response(
      JSON.stringify({
        success: true,
        messages: data.messages || [],
        channelInfo: data.channelInfo || null,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Read Private Channel] Error:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
