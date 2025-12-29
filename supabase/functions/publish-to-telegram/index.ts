import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function getUserFromToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  try {
    const token = authHeader.replace('Bearer ', '');
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.sub;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Publish to Telegram function called');
    
    const userId = getUserFromToken(req.headers.get('Authorization'));
    if (!userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { text, imageUrl, botToken, targetChannel } = await req.json();
    console.log('Publishing:', { text: text?.substring(0, 50), hasImage: !!imageUrl, channel: targetChannel });

    if (!text && !imageUrl) {
      return new Response(JSON.stringify({ error: 'Text or image required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // If botToken and targetChannel are provided, use them directly
    let finalBotToken = botToken;
    let finalChatId = targetChannel;

    // If not provided, fetch from database (backward compatibility)
    if (!finalBotToken || !finalChatId) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get user's bot token
      const { data: botData, error: botError } = await supabase
        .from('telegram_bots')
        .select('bot_token')
        .eq('user_id', userId)
        .eq('is_active', true)
        .single();

      if (botError || !botData) {
        console.error('Bot not found:', botError);
        return new Response(JSON.stringify({ error: 'No active Telegram bot found. Please add a bot first.' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get user's target channel
      const { data: serviceData, error: serviceError } = await supabase
        .from('bot_services')
        .select('target_channel')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (serviceError || !serviceData) {
        console.error('Channel not found:', serviceError);
        return new Response(JSON.stringify({ error: 'Канал не знайдено. Спочатку налаштуйте бот і додайте канал в розділі "Мої канали".' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      finalBotToken = botData.bot_token;
      finalChatId = serviceData.target_channel;
    }

    console.log('Publishing to channel:', finalChatId);

    // Publish to Telegram
    let telegramResponse;
    
    if (imageUrl) {
      console.log('Sending photo to Telegram...');
      
      // Telegram API sendPhoto accepts URL directly in JSON body
      telegramResponse = await fetch(
        `https://api.telegram.org/bot${finalBotToken}/sendPhoto`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: finalChatId,
            photo: imageUrl,
            caption: text || undefined,
            parse_mode: 'HTML',
          }),
        }
      );
    } else {
      console.log('Sending text message to Telegram...');
      // Send text only
      telegramResponse = await fetch(
        `https://api.telegram.org/bot${finalBotToken}/sendMessage`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: finalChatId,
            text: text,
            parse_mode: 'HTML',
          }),
        }
      );
    }

    const result = await telegramResponse.json();

    if (!result.ok) {
      console.error('Telegram API error:', result);
      
      // Auto-pause bot on error
      if (req.url.includes('botServiceId')) {
        try {
          const url = new URL(req.url);
          const botServiceId = url.searchParams.get('botServiceId');
          const serviceType = url.searchParams.get('serviceType') || 'plagiarist';
          
          if (botServiceId) {
            const supabase = createClient(
              Deno.env.get('SUPABASE_URL') ?? '',
              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
            );

            const table = serviceType === 'ai' ? 'ai_bot_services' : 'bot_services';
            
            await supabase
              .from(table)
              .update({
                is_running: false,
                started_at: null,
                last_error: result.description || 'Failed to publish to Telegram',
                last_error_at: new Date().toISOString(),
                error_count: supabase.rpc('increment', { x: 1, y: 1 })
              })
              .eq('id', botServiceId);
            
            console.log(`Bot ${botServiceId} auto-paused due to error`);
          }
        } catch (pauseError) {
          console.error('Failed to auto-pause bot:', pauseError);
        }
      }
      
      return new Response(JSON.stringify({ error: result.description || 'Failed to publish to Telegram' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Successfully published to Telegram');

    // Record publication in posts_history if botServiceId is provided
    if (req.url.includes('botServiceId')) {
      try {
        const url = new URL(req.url);
        const botServiceId = url.searchParams.get('botServiceId');
        
        if (botServiceId) {
          const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
          );

          await supabase.from('posts_history').insert({
            bot_service_id: botServiceId,
            source_channel: 'manual',
            target_channel: finalChatId,
            status: 'success',
            post_content: text?.substring(0, 500),
            has_media: !!imageUrl,
          });
          
          console.log('Recorded publication in posts_history');
        }
      } catch (historyError) {
        console.error('Failed to record in posts_history:', historyError);
        // Don't fail the request if history recording fails
      }
    }

    return new Response(JSON.stringify({ success: true, message: 'Successfully published to Telegram' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
