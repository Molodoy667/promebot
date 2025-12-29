import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getVertexAIToken(serviceAccountJson: string): Promise<string> {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: serviceAccount.client_email,
      scope: "https://www.googleapis.com/auth/cloud-platform",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    };

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

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion: jwt,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get access token: ${await tokenResponse.text()}`);
    }

    const tokenData = await tokenResponse.json();
    return tokenData.access_token;
  } catch (error) {
    console.error('Error generating Vertex AI token:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  console.log('AI Chat Proxy - Request received');
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('No valid auth header');
      return new Response(JSON.stringify({ error: 'Authorization header required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract token directly from header
    const token = authHeader.replace('Bearer ', '');
    
    // Decode JWT to get user info (without full verification - Supabase handles that)
    const tokenParts = token.split('.');
    if (tokenParts.length !== 3) {
      return new Response(JSON.stringify({ error: 'Invalid token format' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    let userId: string;
    try {
      const payload = JSON.parse(atob(tokenParts[1]));
      userId = payload.sub;
      
      // Check if token is expired
      if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
        console.log('Token expired');
        return new Response(JSON.stringify({ error: 'Token expired - please log in again' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      console.log('User ID from token:', userId);
    } catch (e) {
      console.error('Failed to decode token:', e);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create client with user context for RLS
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    const { messages } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'messages array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching AI chat service settings...');
    const { data: aiService, error: serviceError } = await supabaseClient
      .from('ai_service_settings')
      .select('*')
      .eq('service_name', 'ai_chat')
      .eq('is_active', true)
      .single();

    if (serviceError || !aiService) {
      return new Response(
        JSON.stringify({ error: 'AI Chat service not configured' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const apiUrl = aiService.api_endpoint;
    const isVertexAI = aiService.provider?.toLowerCase().includes('vertex') || 
                       apiUrl.includes('aiplatform.googleapis.com');

    let requestBody: any;
    const requestHeaders: any = {
      'Content-Type': 'application/json',
    };

    if (isVertexAI) {
      // Vertex AI Gemini format
      console.log('Using Vertex AI, generating token...');
      const accessToken = await getVertexAIToken(aiService.api_key);
      requestHeaders['Authorization'] = `Bearer ${accessToken}`;
      
      requestBody = {
        contents: messages.map((m: any) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }]
        })),
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1000
        }
      };
    } else {
      // OpenAI/Generic format
      requestHeaders['Authorization'] = `Bearer ${aiService.api_key}`;
      
      requestBody = {
        model: aiService.model_name || 'gpt-3.5-turbo',
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
      };
    }

    console.log('Calling AI API:', apiUrl);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: requestHeaders,
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI API error:', errorText);
      return new Response(
        JSON.stringify({ error: errorText }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const aiResponse = await response.json();
    console.log('AI response received');

    let assistantContent: string;
    if (isVertexAI) {
      assistantContent = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text || "Помилка відповіді AI";
    } else {
      assistantContent = aiResponse.choices?.[0]?.message?.content || "Помилка відповіді AI";
    }

    return new Response(
      JSON.stringify({ content: assistantContent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
