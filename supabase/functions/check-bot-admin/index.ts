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

    // Для числових ID не додаємо @, для username - додаємо
    const chatId = /^-?\d+$/.test(channelUsername) ? channelUsername : `@${channelUsername}`;
    
    // Крок 1: Спочатку перевіряємо чи бот доданий (getChatMember працює навіть для приватних каналів)
    const checkMemberUrl = `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${botToken.split(':')[0]}`;
    
    const memberResponse = await fetch(checkMemberUrl);
    const memberData = await memberResponse.json();

    if (!memberData.ok) {
      // Якщо помилка "chat not found" - це приватний канал, до якого бот не доданий
      if (memberData.description?.includes('chat not found')) {
        return new Response(
          JSON.stringify({ 
            isAdmin: false, 
            isMember: false,
            channelExists: true,
            isChannel: true,
            error: 'Бот не доданий до приватного каналу. Додайте бота як адміністратора.' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Інші помилки
      return new Response(
        JSON.stringify({ 
          isAdmin: false, 
          isMember: false,
          channelExists: false,
          error: memberData.description || 'Не вдалося перевірити бота'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Крок 2: Перевірка прав
    const member = memberData.result;
    const isAdmin = member.status === 'administrator' || member.status === 'creator';

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ 
          isAdmin: false, 
          isMember: true,
          error: 'Бот доданий до каналу, але не має прав адміністратора. Надайте боту права адміністратора.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Крок 3: Отримуємо інфо про канал (тепер вже можемо, бо бот доданий)
    const getChatUrl = `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatId}`;
    const getChatResponse = await fetch(getChatUrl);
    const getChatData = await getChatResponse.json();

    // Перевірка типу (якщо вдалося отримати)
    if (getChatData.ok && getChatData.result.type !== 'channel') {
      const typeMap: Record<string, string> = {
        'group': 'група',
        'supergroup': 'супергрупа',
        'private': 'приватний чат'
      };
      const typeName = typeMap[getChatData.result.type] || getChatData.result.type;
      
      return new Response(
        JSON.stringify({ 
          isAdmin: false, 
          isMember: true,
          channelExists: true,
          isChannel: false,
          error: `Це ${typeName}, а не канал`
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Все ОК
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
