import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// MTProto через Vercel API (Node.js + GramJS)
const VERCEL_API_URL = Deno.env.get('VERCEL_API_URL') || 'https://promobot.store';

/**
 * Авторизація userbot через phone number
 * Два етапи:
 * 1. Send code -> повертає phoneCodeHash
 * 2. Sign in with code -> зберігає session
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { spyId, phoneNumber, phoneCode, phoneCodeHash, sessionString, action } = await req.json();

    if (!spyId) {
      throw new Error('spyId is required');
    }

    // Get spy credentials
    const { data: spy, error: spyError } = await supabaseClient
      .from('telegram_spies')
      .select('*')
      .eq('id', spyId)
      .single();

    if (spyError || !spy) {
      throw new Error('Spy not found');
    }

    console.log(`[Userbot Auth] Action: ${action}, Spy: ${spy.name}`);

    console.log(`[Userbot Auth] Using Vercel API: ${VERCEL_API_URL}`);

    // Action 1: Send code via Vercel API
    if (action === 'send_code') {
      if (!phoneNumber) {
        throw new Error('phoneNumber is required for send_code');
      }

      console.log(`[Userbot Auth] Sending code to ${phoneNumber} via Vercel API`);
      
      const response = await fetch(`${VERCEL_API_URL}/api/userbot-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_code',
          apiId: spy.api_id,
          apiHash: spy.api_hash,
          phoneNumber: phoneNumber,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to send code');
      }

      const data = await response.json();

      return new Response(
        JSON.stringify({
          success: true,
          phoneCodeHash: data.phoneCodeHash,
          message: 'Code sent! Check your Telegram app.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action 2: Sign in via Vercel API
    if (action === 'sign_in') {
      if (!phoneNumber || !phoneCode || !phoneCodeHash) {
        throw new Error('phoneNumber, phoneCode, and phoneCodeHash are required for sign_in');
      }

      console.log(`[Userbot Auth] Signing in via Vercel API`);

      const response = await fetch(`${VERCEL_API_URL}/api/userbot-auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sign_in',
          apiId: spy.api_id,
          apiHash: spy.api_hash,
          phoneNumber: phoneNumber,
          phoneCode: phoneCode,
          phoneCodeHash: phoneCodeHash,
          sessionString: sessionString, // Pass session from send_code
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to sign in');
      }

      const data = await response.json();

      // Save session to database
      await supabaseClient
        .from('telegram_spies')
        .update({
          session_string: data.sessionString,
          is_authorized: true,
          last_error: null,
          error_count: 0,
          last_activity_at: new Date().toISOString(),
        })
        .eq('id', spyId);

      console.log('[Userbot Auth] Session saved to database');

      return new Response(
        JSON.stringify({
          success: true,
          isAuthorized: true,
          message: 'Successfully authorized! Userbot is ready.',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Action 3: Check authorization via Vercel API
    if (action === 'check_auth') {
      if (spy.session_string) {
        try {
          const response = await fetch(`${VERCEL_API_URL}/api/userbot-auth`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'check_auth',
              apiId: spy.api_id,
              apiHash: spy.api_hash,
              sessionString: spy.session_string,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            return new Response(
              JSON.stringify({
                success: true,
                isAuthorized: data.isAuthorized,
                hasSession: true,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        } catch (err) {
          console.error('[Userbot Auth] Error checking auth:', err);
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          isAuthorized: spy.is_authorized || false,
          hasSession: !!spy.session_string,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error(`Unknown action: ${action}`);

  } catch (error: any) {
    console.error('[Userbot Auth] Error:', error);

    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
