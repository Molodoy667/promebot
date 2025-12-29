import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { channelLink } = await req.json();

    if (!channelLink) {
      return new Response(
        JSON.stringify({ success: false, error: 'Channel link is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract channel username or ID from link
    let channelUsername = channelLink;
    let isPrivateChannel = false;
    
    // Handle t.me/+xxx (private channel invite link)
    if (channelLink.includes('t.me/+')) {
      isPrivateChannel = true;
      channelUsername = channelLink.split('t.me/')[1].split('?')[0];
    }
    // Handle t.me/joinchat/xxx (old private channel format)
    else if (channelLink.includes('t.me/joinchat/')) {
      isPrivateChannel = true;
      channelUsername = channelLink.split('t.me/joinchat/')[1].split('?')[0];
    }
    // Handle public channel link t.me/username
    else if (channelLink.includes('t.me/')) {
      channelUsername = channelLink.split('t.me/')[1].split('?')[0].split('/')[0].replace('@', '');
    } 
    // Handle @username format
    else if (channelLink.startsWith('@')) {
      channelUsername = channelLink.substring(1);
    }
    // Handle plain username without @
    else if (!channelLink.includes('/') && !channelLink.includes('http')) {
      // Plain username like "myChannel"
      channelUsername = channelLink.replace('@', '');
    }

    // Get a bot token from telegram_bots table
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: bots } = await supabase
      .from('telegram_bots')
      .select('bot_token')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!bots?.bot_token) {
      // If no bot available, return basic info
      return new Response(
        JSON.stringify({
          success: true,
          channelInfo: {
            username: isPrivateChannel ? null : channelUsername,
            title: isPrivateChannel ? 'Приватний канал' : `@${channelUsername}`,
            photo: null,
            membersCount: null,
            isPrivate: isPrivateChannel,
            note: isPrivateChannel 
              ? 'Приватний канал - перевірка можлива тільки після підписки' 
              : 'Бот недоступний для перевірки публічного каналу'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For private channels, we can't check them directly
    if (isPrivateChannel) {
      return new Response(
        JSON.stringify({
          success: true,
          channelInfo: {
            username: null,
            title: 'Приватний канал',
            photo: null,
            membersCount: null,
            isPrivate: true,
            inviteLink: channelLink,
            note: 'Приватний канал можна перевірити тільки після підписки. Користувачі зможуть підписатись за посиланням-запрошенням.'
          }
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check public channel using Telegram Bot API
    const telegramResponse = await fetch(
      `https://api.telegram.org/bot${bots.bot_token}/getChat`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: `@${channelUsername}` }),
      }
    );

    const telegramData = await telegramResponse.json();

    if (!telegramData.ok) {
      // Try without @ prefix in case it's a channel ID
      const retryResponse = await fetch(
        `https://api.telegram.org/bot${bots.bot_token}/getChat`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: channelUsername }),
        }
      );
      
      const retryData = await retryResponse.json();
      
      if (!retryData.ok) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Канал не знайдено або недоступний. Переконайтесь, що це публічний канал з username (@назва) або приватне посилання-запрошення (t.me/+xxx)' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      telegramData.ok = retryData.ok;
      telegramData.result = retryData.result;
    }

    const chat = telegramData.result;
    
    // Get channel photo if available
    let photoUrl = null;
    if (chat.photo?.big_file_id) {
      try {
        const fileResponse = await fetch(
          `https://api.telegram.org/bot${bots.bot_token}/getFile?file_id=${chat.photo.big_file_id}`
        );
        const fileData = await fileResponse.json();
        if (fileData.ok) {
          photoUrl = `https://api.telegram.org/file/bot${bots.bot_token}/${fileData.result.file_path}`;
        }
      } catch (error) {
        console.error('Error getting channel photo:', error);
      }
    }

    const channelInfo = {
      username: chat.username || channelUsername,
      title: chat.title || chat.first_name || `@${channelUsername}`,
      photo: photoUrl,
      membersCount: chat.members_count || null,
      description: chat.description || null,
      isPrivate: false,
      type: chat.type || 'channel',
    };

    return new Response(
      JSON.stringify({ success: true, channelInfo }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error checking telegram channel:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
