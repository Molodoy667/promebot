import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Validate cron secret to prevent unauthorized access
    const cronSecret = req.headers.get('x-cron-secret');
    const expectedSecret = Deno.env.get('CRON_SECRET');
    
    if (!expectedSecret || cronSecret !== expectedSecret) {
      console.error('Unauthorized access attempt to cleanup-old-files');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('Starting file cleanup process...')

    // 1. Cleanup old ticket attachments (older than 90 days)
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)

    const { data: oldAttachments, error: attachmentsError } = await supabaseClient
      .from('ticket_attachments')
      .select('id, file_path')
      .lt('created_at', ninetyDaysAgo.toISOString())

    if (attachmentsError) {
      console.error('Error fetching old attachments:', attachmentsError)
    } else if (oldAttachments && oldAttachments.length > 0) {
      console.log(`Found ${oldAttachments.length} old attachments to delete`)

      // Delete files from storage
      const filePaths = oldAttachments.map(att => att.file_path)
      const { error: storageError } = await supabaseClient.storage
        .from('ticket-attachments')
        .remove(filePaths)

      if (storageError) {
        console.error('Error deleting files from storage:', storageError)
      }

      // Delete records from database
      const attachmentIds = oldAttachments.map(att => att.id)
      const { error: deleteError } = await supabaseClient
        .from('ticket_attachments')
        .delete()
        .in('id', attachmentIds)

      if (deleteError) {
        console.error('Error deleting attachment records:', deleteError)
      } else {
        console.log(`Deleted ${oldAttachments.length} old attachments`)
      }
    }

    // 2. Cleanup generated post images (older than 10 minutes)
    const tenMinutesAgo = new Date()
    tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10)

    const { data: oldPosts, error: postsError } = await supabaseClient
      .from('posts_history')
      .select('id, post_content')
      .lt('created_at', tenMinutesAgo.toISOString())
      .not('post_content', 'is', null)

    if (postsError) {
      console.error('Error fetching old posts:', postsError)
    } else if (oldPosts && oldPosts.length > 0) {
      console.log(`Found ${oldPosts.length} old posts to check for cleanup`)

      // Extract image URLs from post content and mark for cleanup
      let cleanedCount = 0
      for (const post of oldPosts) {
        if (post.post_content) {
          // Clear the post content to free up storage
          const { error: updateError } = await supabaseClient
            .from('posts_history')
            .update({ post_content: null })
            .eq('id', post.id)

          if (!updateError) {
            cleanedCount++
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`Cleaned ${cleanedCount} old post contents`)
      }
    }

    // 3. List and cleanup orphaned files in storage buckets
    const { data: ticketFiles, error: listError } = await supabaseClient.storage
      .from('ticket-attachments')
      .list()

    if (listError) {
      console.error('Error listing storage files:', listError)
    } else if (ticketFiles) {
      console.log(`Checking ${ticketFiles.length} storage folders for orphaned files`)

      // This is a basic cleanup - in production you'd want more sophisticated logic
      // to verify which files are actually orphaned
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'File cleanup completed successfully',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in cleanup process:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
