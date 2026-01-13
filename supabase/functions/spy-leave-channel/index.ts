import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { spy_id, channel_identifier } = await req.json();

    if (!spy_id || !channel_identifier) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'spy_id and channel_identifier are required' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Proxy to Vercel API
    const vercelUrl = `${Deno.env.get('VERCEL_API_URL') || 'https://promebot.vercel.app'}/api/spy-leave-channel`;
    
    const response = await fetch(vercelUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ spy_id, channel_identifier }),
    });

    const data = await response.json();

    return new Response(
      JSON.stringify(data),
      { 
        status: response.ok ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in spy-leave-channel:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
