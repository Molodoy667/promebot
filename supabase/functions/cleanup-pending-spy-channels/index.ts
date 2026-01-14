import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[Cleanup Pending Spy Channels] Starting cleanup...');

    // Get all pending channels that should be left
    const { data: pendingChannels, error: fetchError } = await supabase
      .from('pending_spy_channels')
      .select('id, spy_id, channel_id, channel_identifier')
      .eq('status', 'pending')
      .lt('should_leave_at', new Date().toISOString());

    if (fetchError) {
      console.error('[Cleanup] Fetch error:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!pendingChannels || pendingChannels.length === 0) {
      console.log('[Cleanup] No pending channels to leave');
      return new Response(
        JSON.stringify({ success: true, message: 'No pending channels to leave', left: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Cleanup] Found ${pendingChannels.length} channels to leave`);

    let successCount = 0;
    let failCount = 0;

    // Leave each channel
    for (const pending of pendingChannels) {
      try {
        console.log(`[Cleanup] Leaving channel ${pending.channel_id} for spy ${pending.spy_id}`);

        const { data: leaveData, error: leaveError } = await supabase.functions.invoke('spy-leave-channel', {
          body: {
            spy_id: pending.spy_id,
            channel_identifier: pending.channel_id
          }
        });

        if (leaveError || !leaveData?.success) {
          console.error(`[Cleanup] Failed to leave channel ${pending.channel_id}:`, leaveError || leaveData?.error);
          failCount++;
          continue;
        }

        // Update status to 'left'
        const { error: updateError } = await supabase
          .from('pending_spy_channels')
          .update({ status: 'left' })
          .eq('id', pending.id);

        if (updateError) {
          console.error(`[Cleanup] Failed to update status for ${pending.id}:`, updateError);
        } else {
          successCount++;
          console.log(`[Cleanup] Successfully left channel ${pending.channel_id}`);
        }
      } catch (err) {
        console.error(`[Cleanup] Error processing channel ${pending.channel_id}:`, err);
        failCount++;
      }
    }

    console.log(`[Cleanup] Cleanup complete. Success: ${successCount}, Failed: ${failCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        left: successCount,
        failed: failCount,
        total: pendingChannels.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Cleanup] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
