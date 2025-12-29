import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIBotService {
  id: string;
  user_id: string;
  bot_id: string;
  target_channel: string;
  is_running: boolean;
  service_type: string;
}

interface PublishingSettings {
  posts_per_day: number;
  post_interval_minutes: number;
  time_from: string | null;
  time_to: string | null;
  include_media: boolean;
  auto_enhance: boolean;
}

interface ContentSource {
  id: string;
  category: string;
  keywords: string[];
  is_active: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('AI Bot Worker started');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all running AI bot services
    const { data: services, error: servicesError } = await supabase
      .from('ai_bot_services')
      .select('*')
      .eq('is_running', true);

    if (servicesError) {
      console.error('Error fetching services:', servicesError);
      throw servicesError;
    }

    if (!services || services.length === 0) {
      console.log('No active AI bot services found');
      return new Response(
        JSON.stringify({ message: 'No active services' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${services.length} active AI bot services`);

    const results = [];

    for (const service of services as AIBotService[]) {
      try {
        console.log(`Processing service ${service.id}`);

        // Get publishing settings
        const { data: settings, error: settingsError } = await supabase
          .from('ai_publishing_settings')
          .select('*')
          .eq('ai_bot_service_id', service.id)
          .limit(1)
          .maybeSingle();

        if (settingsError || !settings) {
          console.log(`No settings for service ${service.id}`);
          continue;
        }

        const publishSettings = settings as PublishingSettings;

        // Check if we're within the allowed time range
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentTime = currentHour * 60 + currentMinute;

        if (publishSettings.time_from && publishSettings.time_to) {
          const [fromHour, fromMinute] = publishSettings.time_from.split(':').map(Number);
          const [toHour, toMinute] = publishSettings.time_to.split(':').map(Number);
          const fromTime = fromHour * 60 + fromMinute;
          const toTime = toHour * 60 + toMinute;

          if (currentTime < fromTime || currentTime > toTime) {
            console.log(`Service ${service.id} outside of allowed time range`);
            continue;
          }
        }

        // Check last publish time from service metadata
        const { data: serviceData } = await supabase
          .from('ai_bot_services')
          .select('last_published_at')
          .eq('id', service.id)
          .single();

        // Check how many scheduled posts exist
        const { count: scheduledCount } = await supabase
          .from('ai_generated_posts')
          .select('*', { count: 'exact', head: true })
          .eq('ai_bot_service_id', service.id)
          .eq('status', 'scheduled');

        const currentScheduled = scheduledCount || 0;
        const maxScheduled = 10;

        console.log(`Service ${service.id} - ${currentScheduled}/${maxScheduled} scheduled posts`);

        // Get oldest scheduled post
        const { data: postToCheck, error: postCheckError } = await supabase
          .from('ai_generated_posts')
          .select('id, created_at')
          .eq('ai_bot_service_id', service.id)
          .eq('status', 'scheduled')
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle();

        if (postCheckError || !postToCheck) {
          console.log(`No scheduled post ready for service ${service.id}`);
          continue;
        }

        const intervalMinutes = publishSettings.post_interval_minutes || 60;
        const postCreatedAt = new Date(postToCheck.created_at);
        const minutesSinceCreation = (now.getTime() - postCreatedAt.getTime()) / (1000 * 60);
        
        // First post: publish after 5 minutes, others: by interval from last publish
        if (!serviceData?.last_published_at) {
          // First post - check if 5 minutes passed since creation
          if (minutesSinceCreation < 5) {
            console.log(`Service ${service.id} - first post not ready yet (${Math.round(minutesSinceCreation)}/5 min)`);
            continue;
          }
          console.log(`Service ${service.id} - publishing first post after 5 minutes`);
        } else {
          // Subsequent posts - check interval from last publish
          const lastPublishTime = new Date(serviceData.last_published_at);
          const minutesSinceLastPublish = (now.getTime() - lastPublishTime.getTime()) / (1000 * 60);
          
          if (minutesSinceLastPublish < intervalMinutes) {
            console.log(`Service ${service.id} - interval not reached yet (${Math.round(minutesSinceLastPublish)}/${intervalMinutes} min)`);
            continue;
          }
          
          console.log(`Service ${service.id} - interval reached (${Math.round(minutesSinceLastPublish)}/${intervalMinutes} min)`);
        }

        // Get next scheduled post
        const { data: pendingPosts, error: postsError } = await supabase
          .from('ai_generated_posts')
          .select('*')
          .eq('ai_bot_service_id', service.id)
          .eq('status', 'scheduled')
          .order('created_at', { ascending: true })
          .limit(1);

        if (postsError) {
          console.error(`Error fetching posts for service ${service.id}:`, postsError);
          continue;
        }

        if (!pendingPosts || pendingPosts.length === 0) {
          console.log(`No scheduled posts for service ${service.id}`);
          continue;
        }

        const postToPublish = pendingPosts[0];
        console.log(`Publishing post ${postToPublish.id} for service ${service.id}`);

        // Get bot token
        const { data: botData, error: botError } = await supabase
          .from('telegram_bots')
          .select('bot_token')
          .eq('id', service.bot_id)
          .single();

        if (botError || !botData) {
          console.error(`Bot not found for service ${service.id}:`, botError);
          continue;
        }

        // Normalize chat_id properly
        let chatId = service.target_channel.trim();
        
        // Extract username from t.me URL if present
        const tmeMatch = chatId.match(/t\.me\/([a-zA-Z0-9_]+)/);
        if (tmeMatch) {
          chatId = tmeMatch[1];
        }
        
        // Check if it's a numeric chat_id (starts with - or is pure number)
        const isNumericChatId = /^-?\d+$/.test(chatId);
        
        if (!isNumericChatId) {
          // It's a username - ensure it starts with @
          if (!chatId.startsWith('@')) {
            chatId = '@' + chatId;
          }
        }
        // If it's numeric, use as-is

        console.log(`Publishing to channel: ${chatId} (original: ${service.target_channel})`);

        // Publish to Telegram
        let telegramResponse;
        if (postToPublish.image_url) {
          const imageUrl = postToPublish.image_url;
          
          // Check if it's a base64 data URL
          if (imageUrl.startsWith('data:')) {
            console.log('Detected base64 image, converting to file upload...');
            
            // Extract base64 data and mime type
            const matches = imageUrl.match(/^data:([^;]+);base64,(.+)$/);
            if (!matches) {
              console.error('Invalid base64 image format');
              // Fall back to text only
              telegramResponse = await fetch(
                `https://api.telegram.org/bot${botData.bot_token}/sendMessage`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    chat_id: chatId,
                    text: postToPublish.content,
                  }),
                }
              );
            } else {
              const mimeType = matches[1];
              const base64Data = matches[2];
              
              // Convert base64 to binary
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
              }
              
              // Create form data with the file
              const formData = new FormData();
              const blob = new Blob([bytes], { type: mimeType });
              const extension = mimeType.split('/')[1] || 'jpg';
              formData.append('photo', blob, `image.${extension}`);
              formData.append('chat_id', chatId);
              if (postToPublish.content) {
                formData.append('caption', postToPublish.content);
              }
              
              telegramResponse = await fetch(
                `https://api.telegram.org/bot${botData.bot_token}/sendPhoto`,
                {
                  method: 'POST',
                  body: formData,
                }
              );
            }
          } else {
            // Regular URL - send via JSON
            telegramResponse = await fetch(
              `https://api.telegram.org/bot${botData.bot_token}/sendPhoto`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  chat_id: chatId,
                  photo: imageUrl,
                  caption: postToPublish.content,
                }),
              }
            );
          }
        } else {
          // Send as text message
          telegramResponse = await fetch(
            `https://api.telegram.org/bot${botData.bot_token}/sendMessage`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: postToPublish.content,
              }),
            }
          );
        }

        const telegramResult = await telegramResponse.json();

        if (!telegramResult.ok) {
          console.error(`Telegram publish failed: { ok: ${telegramResult.ok}, error_code: ${telegramResult.error_code}, description: "${telegramResult.description}" }`);
          
          const errorMessage = `${telegramResult.error_code}: ${telegramResult.description}`;
          
          // Update post status to failed with error details
          await supabase
            .from('ai_generated_posts')
            .update({ 
              status: 'failed',
              error_message: errorMessage
            })
            .eq('id', postToPublish.id);
          
          // Auto-pause bot on Telegram error
          await supabase
            .from('ai_bot_services')
            .update({
              is_running: false,
              started_at: null,
              last_error: errorMessage,
              last_error_at: new Date().toISOString()
            })
            .eq('id', service.id);
          
          // Create error notification
          await supabase.rpc('create_bot_error_notification', {
            p_user_id: service.user_id,
            p_bot_name: 'AI Бот',
            p_channel_name: service.target_channel,
            p_error_message: errorMessage,
            p_service_type: 'ai'
          });
          
          console.log(`Bot ${service.id} auto-paused due to Telegram publish error, notification sent`);
          
          results.push({
            serviceId: service.id,
            postId: postToPublish.id,
            status: 'failed',
            error: telegramResult.description
          });
          
          continue;
        }

        // Update service last publish time
        await supabase
          .from('ai_bot_services')
          .update({ last_published_at: new Date().toISOString() })
          .eq('id', service.id);

        // Generate 1 new post after publishing (to maintain queue of 10)
        const { count: currentCount } = await supabase
          .from('ai_generated_posts')
          .select('*', { count: 'exact', head: true })
          .eq('ai_bot_service_id', service.id)
          .eq('status', 'scheduled');
        
        if ((currentCount || 0) < 10) {
          console.log(`Service ${service.id} - generating 1 post after publish to maintain queue`);
          
          try {
            const generateResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-ai-posts`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                },
                body: JSON.stringify({
                  serviceId: service.id,
                  count: 1,
                }),
              }
            );
            
            if (generateResponse.ok) {
              console.log(`Generated 1 post for service ${service.id}`);
            } else {
              const errorText = await generateResponse.text();
              console.error(`Failed to generate post: ${errorText}`);
            }
          } catch (genError) {
            console.error(`Error generating post:`, genError);
          }
        }

        // Extract message_id from Telegram response
        const messageId = telegramResult.result?.message_id;

        // Update post status to published with message_id
        await supabase
          .from('ai_generated_posts')
          .update({ 
            status: 'published',
            published_at: new Date().toISOString(),
            message_id: messageId
          })
          .eq('id', postToPublish.id);

        console.log(`Successfully published post ${postToPublish.id} (message_id: ${messageId}) for service ${service.id}`);

        // Після публікації генеруємо новий пост якщо менше 10
        const { count: afterPublishCount } = await supabase
          .from('ai_generated_posts')
          .select('*', { count: 'exact', head: true })
          .eq('ai_bot_service_id', service.id)
          .eq('status', 'scheduled');

        if ((afterPublishCount || 0) < 10) {
          try {
            console.log(`Service ${service.id}: generating 1 new post after publication (${afterPublishCount}/10)`);

            const generateResponse = await fetch(
              `${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-ai-posts`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`,
                },
                body: JSON.stringify({
                  serviceId: service.id,
                  count: 1,
                }),
              }
            );

            if (generateResponse.ok) {
              console.log(`Successfully generated new post for service ${service.id}`);
            } else {
              const errorText = await generateResponse.text();
              console.error(`Failed to generate new post for service ${service.id}:`, errorText);
            }
          } catch (generateError) {
            console.error(`Error generating new post for service ${service.id}:`, generateError);
          }
        } else {
          console.log(`Service ${service.id}: queue is full (10/10), skipping generation`);
        }

        results.push({
          serviceId: service.id,
          postId: postToPublish.id,
          status: 'success',
        });

      } catch (error) {
        console.error(`Error processing service ${service.id}:`, error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Auto-pause bot on critical error
        try {
          await supabase
            .from('ai_bot_services')
            .update({
              is_running: false,
              started_at: null,
              last_error: errorMessage,
              last_error_at: new Date().toISOString()
            })
            .eq('id', service.id);
          
          // Create error notification
          await supabase.rpc('create_bot_error_notification', {
            p_user_id: service.user_id,
            p_bot_name: 'AI Бот',
            p_channel_name: service.target_channel,
            p_error_message: errorMessage,
            p_service_type: 'ai'
          });
          
          console.log(`Bot ${service.id} auto-paused due to critical error, notification sent`);
        } catch (pauseError) {
          console.error(`Failed to auto-pause bot ${service.id}:`, pauseError);
        }
        
        results.push({
          serviceId: service.id,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: 'AI Bot Worker completed',
        processed: services.length,
        results: results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Worker error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
