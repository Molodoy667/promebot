import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Авторізація спамера через TData
 * Процес:
 * 1. Завантажити TData файл з storage
 * 2. Розпакувати і перевірити структуру
 * 3. Авторизуватись через MTProto
 * 4. Зберегти session string
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

    const { spammerId, action } = await req.json();

    if (!spammerId) {
      throw new Error('spammerId is required');
    }

    console.log('[Authorize Spammer] Action:', action, 'Spammer:', spammerId);

    // Get spammer info
    const { data: spammer, error: spammerError } = await supabaseClient
      .from('telegram_spammers')
      .select('*')
      .eq('id', spammerId)
      .single();

    if (spammerError || !spammer) {
      throw new Error(`Spammer not found: ${spammerError?.message}`);
    }

    // Action: Check authorization status
    if (action === 'check_auth') {
      return new Response(
        JSON.stringify({
          success: true,
          isAuthorized: spammer.is_authorized,
          hasTData: !!spammer.tdata_path,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action: Authorize using TData
    if (action === 'authorize') {
      // TODO: Implement actual TData authorization
      // For now, just mark as authorized if tdata_path exists
      
      if (!spammer.tdata_path) {
        throw new Error('TData не завантажено');
      }

      await supabaseClient
        .from('telegram_spammers')
        .update({
          is_authorized: true,
          last_activity_at: new Date().toISOString(),
          error_count: 0,
          last_error: null,
        })
        .eq('id', spammerId);

      console.log('[Authorize Spammer] Success');

      return new Response(
        JSON.stringify({
          success: true,
          isAuthorized: true,
          message: 'Спамер авторизовано успішно',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error('[Authorize Spammer] Error:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
