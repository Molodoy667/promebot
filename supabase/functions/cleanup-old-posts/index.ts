import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify cron secret
    const cronSecret = req.headers.get('x-cron-secret');
    if (cronSecret !== Deno.env.get('CRON_SECRET')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('🗑️ Starting automatic cleanup of old posts...');

    // Calculate date 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    console.log(`📅 Deleting posts older than: ${cutoffDate}`);

    // 1. Clean up plagiarist posts (posts_history)
    const { count: plagiaristCount, error: plagiaristError } = await supabase
      .from('posts_history')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffDate)
      .in('status', ['published', 'success', 'failed']); // Keep pending posts

    if (plagiaristError) {
      console.error('Error cleaning plagiarist posts:', plagiaristError);
    } else {
      console.log(`✅ Deleted ${plagiaristCount || 0} plagiarist posts`);
    }

    // 2. Clean up AI posts (ai_generated_posts)
    const { count: aiCount, error: aiError } = await supabase
      .from('ai_generated_posts')
      .delete({ count: 'exact' })
      .lt('created_at', cutoffDate)
      .in('status', ['published', 'failed']); // Don't delete scheduled posts

    if (aiError) {
      console.error('Error cleaning AI posts:', aiError);
    } else {
      console.log(`✅ Deleted ${aiCount || 0} AI posts`);
    }

    const totalDeleted = (plagiaristCount || 0) + (aiCount || 0);

    console.log(`🎉 Cleanup complete! Total deleted: ${totalDeleted} posts`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Old posts cleaned up successfully',
        deleted: {
          plagiarist: plagiaristCount || 0,
          ai: aiCount || 0,
          total: totalDeleted
        },
        cutoffDate
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in cleanup-old-posts:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
