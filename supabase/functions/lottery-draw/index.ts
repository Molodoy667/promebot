import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('Starting lottery draw...');

    // Get lottery settings
    const { data: settings, error: settingsError } = await supabaseClient
      .from('lottery_settings')
      .select('draw_interval_hours')
      .limit(1)
      .single();

    if (settingsError || !settings) {
      console.error('Failed to get lottery settings:', settingsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Settings not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Get active round
    const { data: activeRound, error: roundError } = await supabaseClient
      .from('lottery_rounds')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (roundError || !activeRound) {
      console.log('No active round found');
      return new Response(
        JSON.stringify({ success: false, error: 'No active round' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if round should be drawn using settings interval
    const roundStartTime = new Date(activeRound.start_time).getTime();
    const now = Date.now();
    const intervalMs = (settings.draw_interval_hours || 1) * 60 * 60 * 1000;

    if (now - roundStartTime < intervalMs) {
      console.log('Round not ready for draw yet');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Round not ready',
          time_remaining: Math.ceil((intervalMs - (now - roundStartTime)) / 1000 / 60) + ' minutes'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Draw winner using the stored procedure
    const { data: result, error: drawError } = await supabaseClient
      .rpc('draw_lottery_winner', { p_round_id: activeRound.id });

    if (drawError) {
      console.error('Error drawing winner:', drawError);
      throw drawError;
    }

    console.log('Lottery draw result:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error in lottery-draw function:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
