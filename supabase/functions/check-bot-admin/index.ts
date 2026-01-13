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
    const { botToken, channelUsername } = await req.json();

    if (!botToken || !channelUsername) {
      return new Response(
        JSON.stringify({ error: 'Bot token and channel username are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Крок 1: Перевірка існування та типу каналу
    const getChatUrl = `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${channelUsername}`;
    const getChatResponse = await fetch(getChatUrl);
    const getChatData = await getChatResponse.json();

    if (!getChatData.ok) {
      return new Response(
        JSON.stringify({ 
          isAdmin: false, 
          isMember: false,
          channelExists: false,
          error: getChatData.description || 'Канал не знайдено'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Перевірка типу
    if (getChatData.result.type !== 'channel') {
      const typeMap: Record<string, string> = {
        'group': 'група',
        'supergroup': 'супергрупа',
        'private': 'приватний чат'
      };
      const typeName = typeMap[getChatData.result.type] || getChatData.result.type;
      
      return new Response(
        JSON.stringify({ 
          isAdmin: false, 
          isMember: false,
          channelExists: true,
          isChannel: false,
          error: `Це ${typeName}, а не канал`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Крок 2: Перевірка чи бот доданий
    const checkMemberUrl = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=@${channelUsername}&user_id=${botToken.split(':')[0]}`;
    
    const response = await fetch(checkMemberUrl);
    const data = await response.json();

    if (!data.ok) {
      return new Response(
        JSON.stringify({ 
          isAdmin: false, 
          isMember: false,
          channelExists: true,
          isChannel: true,
          message: 'Бот не доданий до каналу. Будь ласка, додайте бота до вашого каналу.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const member = data.result;
    const isAdmin = member.status === 'administrator' || member.status === 'creator';

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ 
          isAdmin: false, 
          isMember: true,
          message: 'Бот доданий до каналу, але не має прав адміністратора. Надайте боту права адміністратора.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        isAdmin: true, 
        isMember: true,
        message: 'Бот успішно підключений і має всі необхідні права!' 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking bot admin status:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
