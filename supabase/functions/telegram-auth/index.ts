import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TelegramAuthData {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Telegram auth data from request
    const authData: TelegramAuthData = await req.json();
    console.log("Telegram auth data received:", { id: authData.id, username: authData.username });

    // Get bot settings
    const { data: settings, error: settingsError } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "telegram_auth_bot")
      .single();

    if (settingsError || !settings) {
      console.error("Error getting bot settings:", settingsError);
      return new Response(
        JSON.stringify({ error: "Telegram authentication not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const botSettings = settings.value as any;
    if (!botSettings.enabled) {
      return new Response(
        JSON.stringify({ error: "Telegram authentication is disabled" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify Telegram auth hash
    const botToken = botSettings.bot_token;
    const isValid = await verifyTelegramAuth(authData, botToken);
    if (!isValid) {
      console.error("Invalid Telegram auth hash");
      return new Response(
        JSON.stringify({ error: "Invalid authentication data" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user exists by telegram_id
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id, email")
      .eq("telegram_id", authData.id)
      .single();

    let userId: string;

    if (existingProfile) {
      // User exists, update profile
      userId = existingProfile.id;
      console.log("Existing user found:", userId);

      await supabase
        .from("profiles")
        .update({
          telegram_username: authData.username,
          telegram_photo_url: authData.photo_url,
          full_name: `${authData.first_name}${authData.last_name ? ' ' + authData.last_name : ''}`,
          avatar_url: authData.photo_url,
        })
        .eq("id", userId);
    } else {
      // Create new user
      const email = `tg_${authData.id}@telegram.user`;
      const password = crypto.randomUUID();

      console.log("Creating new user for Telegram ID:", authData.id);

      // Get email confirmation setting
      const { data: generalSettings } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "general_settings")
        .single();

      const emailConfirmRequired = generalSettings?.value 
        ? (generalSettings.value as any).email_confirmation_required !== false
        : true;

      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: !emailConfirmRequired,
        user_metadata: {
          full_name: `${authData.first_name}${authData.last_name ? ' ' + authData.last_name : ''}`,
          telegram_id: authData.id,
          telegram_username: authData.username,
        },
      });

      if (authError) {
        console.error("Error creating user:", authError);
        return new Response(
          JSON.stringify({ error: "Failed to create user" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = authUser.user.id;

      // Update profile with Telegram data
      await supabase
        .from("profiles")
        .update({
          telegram_id: authData.id,
          telegram_username: authData.username,
          telegram_photo_url: authData.photo_url,
          avatar_url: authData.photo_url,
          auth_provider: "telegram",
        })
        .eq("id", userId);
    }

    // Generate session token
    const { data: sessionData, error: sessionError } = await supabase.auth.admin.generateLink({
      type: "magiclink",
      email: existingProfile?.email || `tg_${authData.id}@telegram.user`,
    });

    if (sessionError || !sessionData) {
      console.error("Error generating session:", sessionError);
      return new Response(
        JSON.stringify({ error: "Failed to create session" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Auth successful for user:", userId);

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        auth_url: sessionData.properties.action_link,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Telegram auth error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function verifyTelegramAuth(authData: TelegramAuthData, botToken: string): Promise<boolean> {
  const { hash, ...dataToCheck } = authData;
  
  // Create data check string
  const dataCheckArr = Object.keys(dataToCheck)
    .sort()
    .map(key => `${key}=${(dataToCheck as any)[key]}`)
    .join('\n');

  // Create secret key
  const secretKey = await sha256(botToken);
  
  // Create hash
  const calculatedHash = await hmacSha256(dataCheckArr, secretKey);

  return calculatedHash === hash;
}

async function sha256(message: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmacSha256(message: string, key: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(key);
  const messageData = encoder.encode(message);
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
