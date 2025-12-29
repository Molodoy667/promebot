import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { botToken, inviteLink } = await req.json();

    if (!botToken || !inviteLink) {
      return new Response(
        JSON.stringify({ error: 'Bot token and invite link are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Checking private channel with invite link:', inviteLink);

    // Extract chat info from invite link if possible
    // Telegram invite links look like: https://t.me/+ABC123 or https://t.me/joinchat/ABC123
    let chatId = inviteLink;
    
    // Try to get chat info using the bot
    // First, we need to check if bot is already a member
    const getBotUrl = `https://api.telegram.org/bot${botToken}/getMe`;
    const botResponse = await fetch(getBotUrl);
    const botData = await botResponse.json();

    if (!botData.ok) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid bot token',
          canRead: false,
          isAdmin: false,
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const botId = botData.result.id;
    console.log('Bot ID:', botId);

    // For private channels, we need the numeric chat_id
    // The user should add the bot first, then we can check
    // We'll return instructions for the user
    
    return new Response(
      JSON.stringify({ 
        canRead: null,
        isAdmin: null,
        requiresManualAdd: true,
        botUsername: botData.result.username,
        message: `Для приватних каналів:\n1. Додайте бота @${botData.result.username} до вашого приватного каналу як адміністратора\n2. Після додавання, вкажіть числовий ID каналу (chat_id)\n3. Ви можете отримати chat_id, відправивши будь-яке повідомлення в канал після додавання бота`
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking private channel:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
