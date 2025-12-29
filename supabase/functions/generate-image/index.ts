import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

async function getVertexAIToken(serviceAccountJson: string): Promise<string> {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    // Create JWT
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

    // Import private key
    const pemHeader = "-----BEGIN PRIVATE KEY-----";
    const pemFooter = "-----END PRIVATE KEY-----";
    const pemContents = serviceAccount.private_key
      .replace(pemHeader, "")
      .replace(pemFooter, "")
      .replace(/\\n/g, "\n")
      .replace(/\s/g, "");
    
    const binaryDer = Uint8Array.from(atob(pemContents), c => c.charCodeAt(0));
    
    const privateKey = await crypto.subtle.importKey(
      "pkcs8",
      binaryDer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"]
    );

    const jwt = await create({ alg: "RS256", typ: "JWT" }, payload, privateKey);

    // Exchange JWT for access token
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Token exchange error:', error);
      throw new Error(`Failed to get access token: ${error}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Error generating Vertex AI token:', error);
    throw error;
  }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

// Helper function to get user from JWT
function getUserFromToken(authHeader: string | null): string | null {
  if (!authHeader) return null;

  try {
    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    const payloadPart = token.split('.')[1];
    if (!payloadPart) return null;

    const decoded = JSON.parse(base64UrlDecode(payloadPart));
    return decoded?.sub || null;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt) {
      console.error('ERROR: No prompt provided');
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Отримуємо налаштування AI сервісу для генерації зображень
    const supabaseAdminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: imageService, error: serviceError } = await supabaseAdminClient
      .from('ai_service_settings')
      .select('*')
      .eq('service_name', 'image_generation')
      .eq('is_active', true)
      .single();

    if (serviceError || !imageService) {
      console.error('ERROR: AI service not found or inactive:', serviceError);
      return new Response(
        JSON.stringify({ error: "AI service not configured. Please configure in Admin → AI Services" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    console.log('Auth header present:', !!authHeader);
    
    const userId = getUserFromToken(authHeader);
    console.log('User ID from token:', userId);
    
    if (!userId) {
      console.error('No user ID in token');
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if AI tool is enabled
    const { data: settingsData } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_image_tool_enabled')
      .single();

    console.log('AI tool enabled:', settingsData?.value);

    if (!settingsData?.value) {
      console.error('AI tool is disabled');
      return new Response(
        JSON.stringify({ error: "AI tool is currently disabled" }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('bonus_balance')
      .eq('id', userId)
      .single();

    console.log('Profile loaded:', !!profile, 'Balance:', profile?.bonus_balance);

    if (profileError || !profile) {
      console.error('Profile error:', profileError);
      return new Response(
        JSON.stringify({ error: "Profile not found" }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check VIP status
    const { data: vipData } = await supabaseClient
      .from('vip_subscriptions')
      .select('expires_at')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .single();

    const isVip = !!vipData;
    console.log('VIP status:', isVip);

    // Get pricing and VIP discount from tools_settings
    const { data: toolSettings } = await supabaseClient
      .from('tools_settings')
      .select('price, vip_discount_enabled, vip_discount_percent')
      .eq('tool_key', 'image_generation')
      .single();

    const originalPrice = toolSettings?.price || 5;
    let imagePrice = originalPrice;
    let discountPercent = 0;
    
    // Apply VIP discount
    if (isVip && toolSettings?.vip_discount_enabled) {
      discountPercent = toolSettings.vip_discount_percent || 0;
      imagePrice = originalPrice * (1 - discountPercent / 100);
      console.log('VIP discount applied:', discountPercent + '%', 'original:', originalPrice, 'new:', imagePrice);
    }

    // Check balance
    if (profile.bonus_balance < imagePrice) {
      console.error('Insufficient balance:', profile.bonus_balance);
      return new Response(
        JSON.stringify({ error: "Insufficient bonus balance" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Lovable AI Gateway for image generation

    // Prepare API request based on provider
    let imageUrl = '';
    const apiKey = imageService.api_key;
    
    // Генеруємо зображення в залежності від провайдера
    if (imageService.provider === 'openai') {
      console.log('Using OpenAI DALL-E...');
      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: imageService.model || "dall-e-3",
          prompt: prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OpenAI API error:', errorText);
        throw new Error(`OpenAI API error: ${errorText}`);
      }

      const data = await response.json();
      imageUrl = data.data[0].url;
      
    } else if (imageService.provider === 'google' || 
               imageService.provider?.toLowerCase().includes('vertex') ||
               imageService.api_endpoint?.includes('aiplatform.googleapis.com')) {
      console.log('Using Google Vertex AI Imagen directly...');
      
      // Generate access token from service account
      const accessToken = await getVertexAIToken(imageService.api_key);
      console.log('Access token generated successfully');
      
      // Direct Imagen API call - simple and reliable
      const imagenResponse = await fetch(imageService.api_endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instances: [{
            prompt: prompt
          }],
          parameters: {
            sampleCount: 1,
            aspectRatio: "1:1",
            safetyFilterLevel: "block_some",
            personGeneration: "allow_adult"
          }
        })
      });

      if (!imagenResponse.ok) {
        const imagenError = await imagenResponse.text();
        console.error('Imagen API error:', imagenResponse.status, imagenError);
        throw new Error(`Imagen API error: ${imagenError}`);
      }

      const imagenData = await imagenResponse.json();
      console.log('Imagen response received');
      
      const prediction = imagenData.predictions?.[0];
      if (prediction?.bytesBase64Encoded) {
        imageUrl = `data:image/png;base64,${prediction.bytesBase64Encoded}`;
        console.log('Imagen: image generated successfully');
      } else {
        throw new Error('No image data in Imagen response');
      }
    } else {
      throw new Error(`Unsupported provider: ${imageService.provider}`);
    }
    
    if (!imageUrl) {
      console.error('No image generated');
      return new Response(
        JSON.stringify({ error: "No image generated by AI service" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct price from bonus balance
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ bonus_balance: profile.bonus_balance - imagePrice })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating balance:', updateError);
      return new Response(
        JSON.stringify({ error: "Failed to update balance" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create transaction record
    const { error: transactionError } = await supabaseClient
      .from('transactions')
      .insert({
        user_id: userId,
        type: 'ai_image_generation',
        amount: -imagePrice,
        status: 'completed',
        description: isVip && discountPercent > 0
          ? `Генерація зображення AI (VIP знижка -${discountPercent}%: ${originalPrice}₴ → ${imagePrice.toFixed(2)}₴)` 
          : 'Генерація зображення AI',
        metadata: { 
          prompt, 
          from_bonus: true,
          is_vip: isVip,
          original_price: originalPrice,
          discount_percent: discountPercent,
          final_price: imagePrice
        }
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
    }

    console.log('Image generated successfully');

    return new Response(
      JSON.stringify({ imageUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-image function:', error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
