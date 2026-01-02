import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Verify Source Channel
 * Перевіряє канал і визначає тип (публічний/приватний)
 * Для публічних - підключає бота
 * Для приватних - підключає спамера
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

    const body = await req.json();
    console.log('[Verify Source Channel] Request body:', JSON.stringify(body));
    
    const { 
      channel_input, 
      channelInput,
      channel_identifier, 
      channelIdentifier,
      is_private,
      isPrivate,
      invite_hash,
      inviteHash,
      bot_token,
      botToken,
      service_id,
      serviceId
    } = body;
    
    // Support both snake_case and camelCase
    const channelInputValue = channel_input || channelInput;
    const channelIdentifierValue = channel_identifier || channelIdentifier;
    const isPrivateValue = is_private !== undefined ? is_private : isPrivate;
    const inviteHashValue = invite_hash || inviteHash;
    const botTokenValue = bot_token || botToken;
    const serviceIdValue = service_id || serviceId;

    console.log('[Verify Source Channel] Input:', channelInputValue);
    console.log('[Verify Source Channel] Type:', isPrivateValue ? 'private' : 'public');

    let channelInfo = null;

    if (isPrivateValue) {
      // Private channel - use spy (userbot) via MTProto
      console.log('[Verify Source Channel] Private channel detected, using spy (userbot)...');

      // Get active spy with API credentials
      const { data: spy, error: spyError } = await supabaseClient
        .from('telegram_spies')
        .select('id, session_string, api_id, api_hash')
        .eq('is_active', true)
        .eq('is_authorized', true)
        .limit(1)
        .single();

      if (spyError || !spy) {
        console.error('[Verify Source Channel] Spy error:', spyError);
        throw new Error('Активного шпигуна не знайдено. Додайте та авторизуйте userbot в адмін-панелі.');
      }

      if (!spy.session_string) {
        console.error('[Verify Source Channel] Spy has no session_string:', spy.id);
        throw new Error('Шпигун не авторизований. Виконайте авторизацію userbot в адмін-панелі.');
      }

      console.log('[Verify Source Channel] Using spy:', spy.id);
      console.log('[Verify Source Channel] VERCEL_API_URL:', Deno.env.get('VERCEL_API_URL') || 'https://promobot.store');

      // Read private channel via spy MTProto
      const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://promobot.store';
      
      const response = await fetch(`${VERCEL_API_URL}/api/spy-get-channel-info`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_string: spy.session_string,
          api_id: spy.api_id,
          api_hash: spy.api_hash,
          channel_identifier: inviteHashValue ? `+${inviteHashValue}` : channelInputValue,
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Verify Source Channel] Spy API error:', response.status, errorText);
        throw new Error(`Помилка API шпигуна (${response.status}): ${errorText.substring(0, 100)}`);
      }

      const data = await response.json();
      console.log('[Verify Source Channel] Spy response:', JSON.stringify(data));

      if (!data.success || !data.channelInfo) {
        console.error('[Verify Source Channel] Invalid spy response:', data);
        throw new Error(data.error || 'Шпигун не зміг отримати інфо про канал. Перевірте що userbot має доступ до каналу.');
      }

      channelInfo = {
        id: data.channelInfo.id,
        title: data.channelInfo.title || '🔒 Приватний канал',
        type: 'channel',
        username: data.channelInfo.username || null,
        isPrivate: true,
        spyId: spy.id,
        photo_url: data.channelInfo.photo_url || null,
        members_count: data.channelInfo.members_count || null,
      };

      console.log('[Verify Source Channel] Spy got private channel info:', channelInfo.title);

    } else {
      // Public channel - use bot
      console.log('[Verify Source Channel] Public channel, using bot...');

      try {
        // Для Bot API потрібно додати @ перед username
        const chatId = channelInputValue.startsWith('@') || channelInputValue.startsWith('-') 
          ? channelInputValue 
          : `@${channelInputValue}`;
        
        console.log('[Verify Source Channel] Using chat_id:', chatId);
        
        const response = await fetch(
          `https://api.telegram.org/bot${botTokenValue}/getChat?chat_id=${chatId}`
        );

        const data = await response.json();

        if (!data.ok) {
          throw new Error(data.description || 'Не вдалося знайти канал');
        }

        // Get bot chat member info to fetch avatar
        let photoUrl = null;
        if (data.result.photo?.big_file_id) {
          const fileResponse = await fetch(
            `https://api.telegram.org/bot${botTokenValue}/getFile?file_id=${data.result.photo.big_file_id}`
          );
          const fileData = await fileResponse.json();
          if (fileData.ok) {
            photoUrl = `https://api.telegram.org/file/bot${botTokenValue}/${fileData.result.file_path}`;
          }
        }

        channelInfo = {
          id: data.result.id,
          title: data.result.title,
          username: data.result.username,
          type: data.result.type,
          isPrivate: false,
          spyId: null,
          photo_url: photoUrl,
          members_count: data.result.members_count || null,
        };

        console.log('[Verify Source Channel] Bot verified public channel:', channelInfo.title);

      } catch (error: any) {
        throw new Error(`Не вдалося підключитись до каналу: ${error.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        channelInfo,
        isPrivate: isPrivateValue,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Verify Source Channel] Error:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
