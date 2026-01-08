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
    console.log('Checking for expired task submissions...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all in_progress submissions
    const { data: submissions, error: fetchError } = await supabase
      .from('task_submissions')
      .select(`
        id,
        started_at,
        tasks (
          time_limit_hours
        )
      `)
      .eq('status', 'in_progress');

    if (fetchError) throw fetchError;

    if (!submissions || submissions.length === 0) {
      console.log('No in_progress submissions found');
      return new Response(
        JSON.stringify({ message: 'No submissions to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const now = new Date();
    const expiredSubmissions = [];

    for (const submission of submissions) {
      const task = submission.tasks as any;
      const startedAt = new Date(submission.started_at);
      const deadline = new Date(startedAt.getTime() + (task.time_limit_hours * 60 * 60 * 1000));

      if (now > deadline) {
        expiredSubmissions.push(submission.id);
      }
    }

    console.log(`Found ${expiredSubmissions.length} expired submissions`);

    if (expiredSubmissions.length > 0) {
      // Delete expired submissions (this returns tasks to available)
      const { error: deleteError } = await supabase
        .from('task_submissions')
        .delete()
        .in('id', expiredSubmissions);

      if (deleteError) throw deleteError;

      console.log(`Deleted ${expiredSubmissions.length} expired submissions`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        expired: expiredSubmissions.length,
        message: `Processed ${expiredSubmissions.length} expired submissions` 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
