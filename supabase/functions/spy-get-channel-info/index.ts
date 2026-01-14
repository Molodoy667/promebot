import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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

    // Get Vercel API URL from environment
    const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://promobot.store';

    console.log(`Calling Vercel API: ${VERCEL_API_URL}/api/spy-get-channel-info`);

    // Forward request to Vercel API
    const response = await fetch(`${VERCEL_API_URL}/api/spy-get-channel-info`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        spy_id,
        channel_identifier
      })
    });

    const data = await response.json();

    console.log('Vercel API response:', data);

    return new Response(
      JSON.stringify(data),
      { 
        status: response.ok ? 200 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in spy-get-channel-info:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Internal server error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
