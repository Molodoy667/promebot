import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
      language_code?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    date: number;
  };
  channel_post?: {
    message_id: number;
    chat: {
      id: number;
      title?: string;
      username?: string;
      type: string;
    };
    text?: string;
    caption?: string;
    photo?: any[];
    video?: any;
    document?: any;
    audio?: any;
    voice?: any;
    video_note?: any;
    animation?: any;
    date: number;
  };
  callback_query?: {
    id: string;
    from: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
    message: any;
    data: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get bot token from URL path (e.g., /telegram-webhook?bot_token=xxx)
    const url = new URL(req.url);
    const botToken = url.searchParams.get("bot_token");

    if (!botToken) {
      console.error("No bot token provided");
      return new Response(JSON.stringify({ ok: false }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get bot from database
    const { data: bot, error: botError } = await supabase
      .from("telegram_bots")
      .select("*")
      .eq("bot_token", botToken)
      .single();

    if (botError || !bot) {
      console.error("Bot not found:", botError);
      return new Response(JSON.stringify({ ok: false }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const update: TelegramUpdate = await req.json();
    console.log("Telegram update received:", JSON.stringify(update, null, 2));

    // Handle channel post (новий пост в каналі)
    if (update.channel_post) {
      console.log("Channel post detected, processing...");
      await handleChannelPost(update.channel_post, bot, supabase);
    }

    // Handle callback query (button press)
    if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, bot, supabase);
    }

    // Handle text message
    if (update.message?.text) {
      await handleMessage(update.message, bot, supabase);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function handleMessage(
  message: any,
  bot: any,
  supabase: any
) {
  const chatId = message.chat.id;
  const text = message.text;
  const userId = message.from.id;

  // Handle /start command
  if (text === "/start") {
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🔐 Авторизуватись на сайті",
            callback_data: "auth_website",
          },
        ],
      ],
    };

    await sendTelegramMessage(
      bot.bot_token,
      chatId,
      "👋 Вітаю! Я бот для авторизації на TelePostBot.\n\nНатисніть кнопку нижче, щоб авторизуватись на сайті:",
      keyboard
    );
  }

  // Update last activity
  await supabase
    .from("telegram_bots")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", bot.id);
}

async function handleCallbackQuery(
  callbackQuery: any,
  bot: any,
  supabase: any
) {
  const chatId = callbackQuery.message.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  if (data === "auth_website") {
    // Check if user already exists in profiles by telegram_id
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email, telegram_id")
      .eq("telegram_id", userId)
      .single();

    let authUrl = "";

    if (existingProfile) {
      // User exists - generate magic link
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: existingProfile.email,
      });

      if (linkError || !linkData) {
        await sendTelegramMessage(
          bot.bot_token,
          chatId,
          "❌ Помилка авторизації. Спробуйте пізніше."
        );
        return;
      }

      authUrl = linkData.properties.action_link;
    } else {
      // New user - create account  
      const email = `tg_${userId}@telegram.user`;
      // Use random UUID for password - secure and unpredictable
      const password = crypto.randomUUID();
      const fullName = `${callbackQuery.from.first_name}${
        callbackQuery.from.last_name ? " " + callbackQuery.from.last_name : ""
      }`;

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: fullName,
          telegram_id: userId,
          telegram_username: callbackQuery.from.username,
        },
      });

      if (authError || !authUser) {
        await sendTelegramMessage(
          bot.bot_token,
          chatId,
          "❌ Помилка створення акаунту. Спробуйте пізніше."
        );
        return;
      }

      // Update profile with Telegram data
      await supabase
        .from("profiles")
        .update({
          telegram_id: userId,
          telegram_username: callbackQuery.from.username,
          auth_provider: "telegram",
          full_name: fullName,
        })
        .eq("id", authUser.user.id);

      // Generate magic link
      const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email,
      });

      if (linkError || !linkData) {
        await sendTelegramMessage(
          bot.bot_token,
          chatId,
          "❌ Помилка авторизації. Спробуйте пізніше."
        );
        return;
      }

      authUrl = linkData.properties.action_link;
    }

    // Send success message with link
    const keyboard = {
      inline_keyboard: [
        [
          {
            text: "🌐 Відкрити сайт",
            url: authUrl,
          },
        ],
      ],
    };

    await sendTelegramMessage(
      bot.bot_token,
      chatId,
      "✅ Ви успішно авторизувались на сайті!\n\nНатисніть кнопку нижче, щоб перейти:",
      keyboard
    );

    // Answer callback query
    await fetch(`https://api.telegram.org/bot${bot.bot_token}/answerCallbackQuery`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        callback_query_id: callbackQuery.id,
        text: "✅ Авторизація успішна!",
      }),
    });
  }
}

async function handleChannelPost(
  channelPost: any,
  bot: any,
  supabase: any
) {
  try {
    const chatId = channelPost.chat.id;
    const chatUsername = channelPost.chat.username ? `@${channelPost.chat.username}` : chatId.toString();
    
    console.log(`Channel post from: ${chatUsername} (ID: ${chatId})`);

    // Знайти всі активні bot_services для цього бота
    const { data: botServices, error: servicesError } = await supabase
      .from("bot_services")
      .select("*, source_channels(*)")
      .eq("is_running", true);

    if (servicesError || !botServices || botServices.length === 0) {
      console.log("No active bot services found");
      return;
    }

    // Перевірити кожен bot_service
    for (const botService of botServices) {
      const sourceChannels = botService.source_channels || [];
      
      // Перевірити, чи цей канал є джерельним
      const isSourceChannel = sourceChannels.some((sc: any) => {
        const scId = sc.channel_username.toString().replace('@', '');
        const currentId = chatUsername.toString().replace('@', '');
        const matchUsername = scId === currentId;
        const matchId = sc.channel_username === chatId.toString();
        
        console.log(`Comparing: ${sc.channel_username} with ${chatUsername} (${chatId})`);
        console.log(`Match by username: ${matchUsername}, Match by ID: ${matchId}`);
        
        return sc.is_active && (matchUsername || matchId);
      });

      if (!isSourceChannel) {
        console.log(`Channel ${chatUsername} is not a source for bot_service ${botService.id}`);
        continue;
      }

      console.log(`Found matching bot_service ${botService.id} for channel ${chatUsername}`);

      // Перевірка фільтра ключових слів
      const postText = channelPost.text || channelPost.caption || "";
      const keywordsFilter = botService.keywords_filter || [];
      
      if (keywordsFilter.length > 0) {
        const hasKeyword = keywordsFilter.some((keyword: string) =>
          postText.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (!hasKeyword) {
          console.log("Post filtered out by keywords");
          continue;
        }
      }

      // Перевірка ліміту постів
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from("posts_history")
        .select("id", { count: "exact" })
        .eq("bot_service_id", botService.id)
        .gte("created_at", `${today}T00:00:00`)
        .eq("status", "success");

      if (count && count >= botService.posts_per_day) {
        console.log(`Daily limit reached for bot_service ${botService.id}`);
        continue;
      }

      // Копіювання посту
      const targetChannel = botService.target_channel;
      console.log(`Copying post to ${targetChannel}`);

      try {
        let copyResult;

        // Визначити тип контенту і скопіювати
        if (channelPost.photo && botService.include_media) {
          // Копіювати фото
          const photo = channelPost.photo[channelPost.photo.length - 1]; // Найбільше фото
          copyResult = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendPhoto`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetChannel,
              photo: photo.file_id,
              caption: channelPost.caption || "",
            }),
          });
        } else if (channelPost.video && botService.include_media) {
          // Копіювати відео
          copyResult = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendVideo`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetChannel,
              video: channelPost.video.file_id,
              caption: channelPost.caption || "",
            }),
          });
        } else if (channelPost.document && botService.include_media) {
          // Копіювати документ
          copyResult = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendDocument`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetChannel,
              document: channelPost.document.file_id,
              caption: channelPost.caption || "",
            }),
          });
        } else if (channelPost.text) {
          // Копіювати текст
          copyResult = await fetch(`https://api.telegram.org/bot${bot.bot_token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: targetChannel,
              text: channelPost.text,
            }),
          });
        }

        if (copyResult) {
          const result = await copyResult.json();
          
          if (result.ok) {
            console.log("Post copied successfully to Telegram");
            
            // Зберегти історію в БД з детальною перевіркою
            const { data: insertedPost, error: insertError } = await supabase
              .from("posts_history")
              .insert({
                bot_service_id: botService.id,
                source_channel: chatUsername,
                target_channel: targetChannel,
                post_content: postText.substring(0, 500),
                has_media: !!(channelPost.photo || channelPost.video || channelPost.document),
                status: "success",
              })
              .select()
              .single();
            
            if (insertError) {
              console.error("ERROR inserting into posts_history:", insertError);
              console.error("Failed data:", {
                bot_service_id: botService.id,
                source_channel: chatUsername,
                target_channel: targetChannel,
              });
            } else {
              console.log("Successfully saved to posts_history, record ID:", insertedPost?.id);
            }
          } else {
            console.error("Failed to copy post to Telegram:", result);
            
            const errorMessage = result.description || "Unknown error";
            
            const { error: insertError } = await supabase
              .from("posts_history")
              .insert({
                bot_service_id: botService.id,
                source_channel: chatUsername,
                target_channel: targetChannel,
                post_content: postText.substring(0, 500),
                status: "failed",
                error_message: errorMessage,
              });
            
            if (insertError) {
              console.error("ERROR inserting failed post into posts_history:", insertError);
            }
            
            // Auto-pause bot on Telegram error
            await supabase
              .from('bot_services')
              .update({
                is_running: false,
                started_at: null,
                last_error: errorMessage,
                last_error_at: new Date().toISOString()
              })
              .eq('id', botService.id);
            
            // Create error notification
            await supabase.rpc('create_bot_error_notification', {
              p_user_id: botService.user_id,
              p_bot_name: 'Плагіатор',
              p_channel_name: targetChannel,
              p_error_message: errorMessage,
              p_service_type: 'plagiarist'
            });
            
            console.log(`Bot ${botService.id} auto-paused due to Telegram error, notification sent`);
          }
        }
      } catch (copyError: any) {
        console.error("EXCEPTION while copying post:", copyError);
        
        const errorMessage = copyError.message || "Unknown error";
        
        const { error: insertError } = await supabase
          .from("posts_history")
          .insert({
            bot_service_id: botService.id,
            source_channel: chatUsername,
            target_channel: targetChannel,
            post_content: postText.substring(0, 500),
            status: "failed",
            error_message: errorMessage,
          });
        
        if (insertError) {
          console.error("ERROR inserting exception into posts_history:", insertError);
        }
        
        // Auto-pause bot on critical error
        try {
          await supabase
            .from('bot_services')
            .update({
              is_running: false,
              started_at: null,
              last_error: errorMessage,
              last_error_at: new Date().toISOString()
            })
            .eq('id', botService.id);
          
          // Create error notification
          await supabase.rpc('create_bot_error_notification', {
            p_user_id: botService.user_id,
            p_bot_name: 'Плагіатор',
            p_channel_name: targetChannel,
            p_error_message: errorMessage,
            p_service_type: 'plagiarist'
          });
          
          console.log(`Bot ${botService.id} auto-paused due to critical error, notification sent`);
        } catch (pauseError) {
          console.error(`Failed to auto-pause bot ${botService.id}:`, pauseError);
        }
      }
    }
  } catch (error: any) {
    console.error("Error in handleChannelPost:", error);
  }
}

async function sendTelegramMessage(
  botToken: string,
  chatId: number,
  text: string,
  replyMarkup?: any
) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body: any = {
    chat_id: chatId,
    text: text,
    parse_mode: "HTML",
  };

  if (replyMarkup) {
    body.reply_markup = replyMarkup;
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const result = await response.json();
  console.log("Send message result:", result);
  return result;
}
