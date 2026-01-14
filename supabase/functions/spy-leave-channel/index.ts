import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://promebot.vercel.app'

serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { spy_id, channel_id } = await req.json()

    console.log('[Spy Leave Channel] Forwarding to Vercel API:', { spy_id, channel_id })

    const response = await fetch(`${VERCEL_API_URL}/api/spy-leave-channel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ spy_id, channel_id }),
    })

    const data = await response.json()
    console.log('[Spy Leave Channel] Vercel API response:', data)

    return new Response(
      JSON.stringify(data),
      { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error: any) {
    console.error('[Spy Leave Channel] Error:', error.message)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
