import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { bot_token } = await req.json();

    if (!bot_token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Bot token is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Test bot by calling getMe endpoint
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${bot_token}/getMe`
    );

    const result = await telegramResponse.json();

    if (!result.ok) {
      console.error('Telegram API error:', result);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.description || 'Invalid bot token' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Bot tested successfully:', result.result);

    return new Response(
      JSON.stringify({
        success: true,
        bot_info: {
          id: result.result.id,
          username: result.result.username,
          first_name: result.result.first_name,
          can_join_groups: result.result.can_join_groups,
          can_read_all_group_messages: result.result.can_read_all_group_messages,
          supports_inline_queries: result.result.supports_inline_queries,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error testing bot:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to test bot';
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
