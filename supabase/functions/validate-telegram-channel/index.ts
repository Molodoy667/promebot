import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ChannelInfo {
  username?: string;
  title: string;
  photo?: string;
  membersCount?: number;
  isValid: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { channelLink, taskId } = await req.json();

    if (!channelLink) {
      return new Response(
        JSON.stringify({ success: false, error: 'Channel link is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Validate URL format
    if (!channelLink.includes('t.me/')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid Telegram link format. Must contain t.me/' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Try to get channel info using check-telegram-channel function
    const { data: channelData, error: channelError } = await supabaseClient.functions.invoke(
      'check-telegram-channel',
      { body: { channelLink } }
    );

    if (channelError) {
      console.error('Error checking channel:', channelError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to validate channel',
          details: channelError.message 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const channelInfo: ChannelInfo = channelData?.channelInfo || {
      title: 'Unknown Channel',
      isValid: false
    };

    // If taskId provided, update the task with validated channel info
    if (taskId && channelInfo.isValid) {
      const { error: updateError } = await supabaseClient
        .from('tasks')
        .update({
          telegram_channel_link: channelLink,
          channel_info: {
            username: channelInfo.username,
            title: channelInfo.title,
            photo: channelInfo.photo,
            membersCount: channelInfo.membersCount,
            validatedAt: new Date().toISOString()
          }
        })
        .eq('id', taskId);

      if (updateError) {
        console.error('Error updating task:', updateError);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Failed to update task with channel info',
            channelInfo 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: channelInfo.isValid,
        channelInfo,
        message: channelInfo.isValid 
          ? 'Channel validated successfully' 
          : 'Channel not found or invalid'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('Error in validate-telegram-channel:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
