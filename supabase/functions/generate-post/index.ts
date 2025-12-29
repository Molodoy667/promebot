import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { create } from "https://deno.land/x/djwt@v3.0.2/mod.ts";

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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function base64UrlDecode(input: string): string {
  const base64 = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return atob(padded);
}

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

  console.log('Generate post function called');

  try {
    const { prompt, withImage, withTags = true } = await req.json();
    console.log('Prompt:', prompt, 'With image:', withImage, 'With tags:', withTags);

    if (!prompt) {
      console.error('No prompt provided');
      return new Response(
        JSON.stringify({ error: "Prompt is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const authHeader = req.headers.get('Authorization');
    const userId = getUserFromToken(authHeader);
    
    if (!userId) {
      console.error('No user ID in token');
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if AI post tool is enabled
    const { data: settingsData } = await supabaseClient
      .from('app_settings')
      .select('value')
      .eq('key', 'ai_post_tool_enabled')
      .single();

    console.log('AI post tool enabled:', settingsData?.value);

    if (!settingsData?.value) {
      console.error('AI post tool is disabled');
      return new Response(
        JSON.stringify({ error: "AI post tool is currently disabled" }),
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

    // Get pricing from tools_settings
    const { data: postToolSettings } = await supabaseClient
      .from('tools_settings')
      .select('price, vip_discount_enabled, vip_discount_percent')
      .eq('tool_key', 'post_generation')
      .single();

    const { data: imageToolSettings } = await supabaseClient
      .from('tools_settings')
      .select('price, vip_discount_enabled, vip_discount_percent')
      .eq('tool_key', 'image_generation')
      .single();

    const originalPostTextPrice = postToolSettings?.price || 5;
    const originalPostImagePrice = imageToolSettings?.price || 5;
    let postTextPrice = originalPostTextPrice;
    let postImagePrice = originalPostImagePrice;
    let textDiscountPercent = 0;
    let imageDiscountPercent = 0;
    
    // Apply VIP discount
    if (isVip) {
      if (postToolSettings?.vip_discount_enabled) {
        textDiscountPercent = postToolSettings.vip_discount_percent || 0;
        postTextPrice = originalPostTextPrice * (1 - textDiscountPercent / 100);
        console.log('VIP text discount applied:', textDiscountPercent + '%', originalPostTextPrice, '→', postTextPrice);
      }
      if (withImage && imageToolSettings?.vip_discount_enabled) {
        imageDiscountPercent = imageToolSettings.vip_discount_percent || 0;
        postImagePrice = originalPostImagePrice * (1 - imageDiscountPercent / 100);
        console.log('VIP image discount applied:', imageDiscountPercent + '%', originalPostImagePrice, '→', postImagePrice);
      }
    }
    
    const originalTotalCost = withImage ? originalPostTextPrice + originalPostImagePrice : originalPostTextPrice;
    const totalCost = withImage ? postTextPrice + postImagePrice : postTextPrice;

    // Check balance
    if (profile.bonus_balance < totalCost) {
      console.error('Insufficient balance:', profile.bonus_balance, 'Required:', totalCost);
      return new Response(
        JSON.stringify({ error: `Insufficient bonus balance. Required: ${totalCost}₴` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Load AI service settings from database
    const { data: textService, error: textServiceError } = await supabaseClient
      .from('ai_service_settings')
      .select('*')
      .eq('service_name', 'text_generation')
      .eq('is_active', true)
      .single();

    if (textServiceError || !textService) {
      console.error('Text generation service not configured:', textServiceError);
      return new Response(
        JSON.stringify({ error: "AI service not configured in admin panel" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!textService.api_key) {
      console.error('Text generation API key not configured');
      return new Response(
        JSON.stringify({ error: "API key not configured. Please configure in Admin → AI Services" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate text post
    console.log('Generating text for prompt:', prompt);
    
    // Load category prompts from database
    const { data: dbCategoryPrompts } = await supabaseClient
      .from('category_prompts')
      .select('category_key, category_name, custom_prompt, use_custom_prompt');
    
    // Build category prompts map from database
    const categoryPrompts: Record<string, string> = {};
    if (dbCategoryPrompts) {
      dbCategoryPrompts.forEach(cp => {
        if (cp.use_custom_prompt && cp.custom_prompt) {
          // Use category_key if available, otherwise use category_name
          const key = cp.category_key || cp.category_name.toLowerCase();
          categoryPrompts[key] = cp.custom_prompt.replace(/\{prompt\}/g, prompt);
        }
      });
    }
    
    console.log('Loaded category prompts from DB:', Object.keys(categoryPrompts));
    
    // Detect category from prompt
    const categoryKey = Object.keys(categoryPrompts).find(key => 
      prompt.toLowerCase().includes(key)
    );
    
    let textPrompt = categoryKey && categoryPrompts[categoryKey] 
      ? categoryPrompts[categoryKey]
      : `${prompt}

Створи цікавий пост для Telegram каналу. Пост має бути:
- Написаний у природному, живому стилі
- З реалістичним та захоплюючим контентом
- 350-500 символів
- З відповідними емодзі для привабливості
${withTags ? '- З релевантними хештегами в кінці' : '- БЕЗ хештегів'}
- Українською мовою
Формат має бути готовим до публікації без жодних додаткових роз'яснень.`;

    // Modify prompt based on withTags setting
    if (withTags) {
      // Add explicit instruction to include hashtags
      textPrompt += `\n\nВАЖЛИВО: Обов'язково додай 5-10 релевантних хештегів (#) в кінці посту! Наприклад: #тема #категорія #цікаво`;
    } else {
      // Remove hashtag instructions from category prompts and add explicit instruction to NOT use hashtags
      textPrompt = textPrompt
        .replace(/- З хештегами.*в кінці\n?/gi, '')
        .replace(/- З релевантними хештегами.*\n?/gi, '')
        .replace(/хештег[иіа]?/gi, '')
        .replace(/#\w+/g, '');
      
      // Add explicit instruction at the end to ensure no hashtags
      textPrompt += `\n\nВАЖЛИВО: НЕ ВИКОРИСТОВУЙ ЖОДНИХ ХЕШТЕГІВ (#) у відповіді! Текст має бути без хештегів!`;
    }

    console.log('Using AI service:', textService.provider, 'Model:', textService.model_name);

    // Check if this is Vertex AI
    const isVertexAI = textService.provider?.toLowerCase().includes('vertex') || 
                       textService.api_endpoint?.includes('aiplatform.googleapis.com');

    let textRequestBody: any;
    const textRequestHeaders: any = {
      'Content-Type': 'application/json',
    };

    if (isVertexAI) {
      // Vertex AI Gemini format
      const accessToken = await getVertexAIToken(textService.api_key);
      textRequestHeaders['Authorization'] = `Bearer ${accessToken}`;
      
      textRequestBody = {
        contents: [{
          role: "user",
          parts: [{
            text: textPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: 1024
        }
      };
    } else {
      // OpenAI/Generic format
      textRequestHeaders['Authorization'] = `Bearer ${textService.api_key}`;
      
      textRequestBody = {
        model: textService.model_name,
        messages: [
          {
            role: 'user',
            content: textPrompt
          }
        ]
      };
    }

    const textResponse = await fetch(textService.api_endpoint, {
      method: 'POST',
      headers: textRequestHeaders,
      body: JSON.stringify(textRequestBody),
    });

    if (!textResponse.ok) {
      const errorText = await textResponse.text();
      console.error('AI Gateway error:', textResponse.status, errorText);
      
      if (textResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded, please try again later" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (textResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: "Payment required, please contact administrator" }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: "Failed to generate post text" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const textData = await textResponse.json();
    
    let postText: string | undefined;
    if (isVertexAI) {
      // Vertex AI Gemini response
      postText = textData.candidates?.[0]?.content?.parts?.[0]?.text;
    } else {
      // OpenAI/Generic response
      postText = textData.choices?.[0]?.message?.content;
    }
    
    if (!postText) {
      console.error('No text in response:', JSON.stringify(textData));
      return new Response(
        JSON.stringify({ error: "Failed to generate post text" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let imageUrl = null;

    // Generate image if requested
    if (withImage) {
      console.log('Generating image for prompt:', prompt);
      
      // Category-specific image prompts
      const imagePrompts: Record<string, string> = {
        news: `Create a professional, realistic news banner image. Context: ${prompt}. Style: clean, modern journalism aesthetic with subtle colors, professional typography feel. Ultra high resolution, 16:9 aspect ratio, news-worthy composition.`,
        
        tech: `Create a sleek, modern technology illustration. Context: ${prompt}. Style: futuristic, high-tech aesthetic with blues and purples, digital interface elements, innovation focus. Ultra high resolution, 16:9 aspect ratio.`,
        
        fantasy: `Create an atmospheric fantasy scene. Context: ${prompt}. Style: mystical, dramatic lighting, rich colors, cinematic composition, magical atmosphere. Ultra high resolution, 16:9 aspect ratio.`,
        
        business: `Create a professional business visual. Context: ${prompt}. Style: corporate, clean design, charts or growth elements, professional color palette. Ultra high resolution, 16:9 aspect ratio.`,
        
        lifestyle: `Create an inspiring lifestyle image. Context: ${prompt}. Style: warm, inviting, aesthetically pleasing, natural light, cozy atmosphere. Ultra high resolution, 16:9 aspect ratio.`,
        
        science: `Create a scientific visualization. Context: ${prompt}. Style: educational, detailed, precise, laboratory or space theme, scientific accuracy feel. Ultra high resolution, 16:9 aspect ratio.`,
        
        education: `Create an educational illustration. Context: ${prompt}. Style: clear, informative, colorful but professional, learning-focused composition. Ultra high resolution, 16:9 aspect ratio.`,
        
        health: `Create a health and wellness image. Context: ${prompt}. Style: clean, calming, natural colors, wellness-focused, professional medical feel. Ultra high resolution, 16:9 aspect ratio.`,
        
        fitness: `Create an energetic fitness image. Context: ${prompt}. Style: dynamic, motivational, athletic, high-energy composition with motion. Ultra high resolution, 16:9 aspect ratio.`,
        
        food: `Create a mouthwatering food photography image. Context: ${prompt}. Style: appetizing, professional food styling, warm lighting, close-up detail. Ultra high resolution, 16:9 aspect ratio.`,
        
        travel: `Create a stunning travel destination image. Context: ${prompt}. Style: breathtaking landscape or cityscape, travel photography aesthetic, vibrant colors. Ultra high resolution, 16:9 aspect ratio.`,
        
        motivation: `Create an inspirational motivational image. Context: ${prompt}. Style: powerful, uplifting, dramatic sky or mountain, inspiring composition. Ultra high resolution, 16:9 aspect ratio.`,
        
        entertainment: `Create a vibrant entertainment image. Context: ${prompt}. Style: colorful, fun, cinematic, pop culture aesthetic, eye-catching composition. Ultra high resolution, 16:9 aspect ratio.`,
        
        gaming: `Create an epic gaming visual. Context: ${prompt}. Style: game artwork aesthetic, dramatic lighting, action-packed, digital art quality. Ultra high resolution, 16:9 aspect ratio.`,
        
        crypto: `Create a modern cryptocurrency visualization. Context: ${prompt}. Style: digital, blockchain aesthetic, neon colors, technological feel, charts or coins. Ultra high resolution, 16:9 aspect ratio.`,
        
        finance: `Create a financial market image. Context: ${prompt}. Style: professional, graphs and charts, market data visualization, corporate colors. Ultra high resolution, 16:9 aspect ratio.`,
        
        psychology: `Create a thoughtful psychology concept image. Context: ${prompt}. Style: abstract, mind-related imagery, calming colors, introspective mood. Ultra high resolution, 16:9 aspect ratio.`,
        
        art: `Create an artistic visual masterpiece. Context: ${prompt}. Style: creative, gallery-worthy, unique artistic style, visually striking composition. Ultra high resolution, 16:9 aspect ratio.`,
        
        music: `Create a musical atmosphere image. Context: ${prompt}. Style: concert or studio aesthetic, musical instruments, vibrant lighting, dynamic composition. Ultra high resolution, 16:9 aspect ratio.`,
        
        sport: `Create an action-packed sports image. Context: ${prompt}. Style: dynamic, athletic action, stadium atmosphere, energetic composition. Ultra high resolution, 16:9 aspect ratio.`
      };
      
      const imageKey = Object.keys(imagePrompts).find(key => 
        prompt.toLowerCase().includes(key)
      );
      
      const imagePrompt = imageKey && imagePrompts[imageKey]
        ? imagePrompts[imageKey]
        : `Create a high-quality, eye-catching image for a Telegram post. Context: ${prompt}. The image should be vibrant, professional, and suitable for social media. Ultra high resolution, 16:9 aspect ratio.`;

      // Load image generation service
      const { data: imageService } = await supabaseClient
        .from('ai_service_settings')
        .select('*')
        .eq('service_name', 'image_generation')
        .eq('is_active', true)
        .single();

      if (imageService && imageService.api_key) {
        console.log('Using image service:', imageService.provider, 'Model:', imageService.model_name);

        // Check if this is Vertex AI
        const isVertexAIImage = imageService.provider?.toLowerCase().includes('vertex') || 
                                imageService.api_endpoint?.includes('aiplatform.googleapis.com');

        let imageRequestBody: any;
        const imageRequestHeaders: any = {
          'Content-Type': 'application/json',
        };

        if (isVertexAIImage) {
          // Vertex AI Imagen format
          const accessToken = await getVertexAIToken(imageService.api_key);
          imageRequestHeaders['Authorization'] = `Bearer ${accessToken}`;
          
          imageRequestBody = {
            instances: [{
              prompt: imagePrompt
            }],
            parameters: {
              sampleCount: 1,
              aspectRatio: "1:1",
              safetyFilterLevel: "block_some",
              personGeneration: "allow_adult"
            }
          };
        } else {
          // OpenAI/Generic format
          imageRequestHeaders['Authorization'] = `Bearer ${imageService.api_key}`;
          
          imageRequestBody = {
            model: imageService.model_name,
            messages: [
              {
                role: 'user',
                content: imagePrompt
              }
            ],
            modalities: ['image', 'text']
          };
        }

        const imageResponse = await fetch(imageService.api_endpoint, {
          method: 'POST',
          headers: imageRequestHeaders,
          body: JSON.stringify(imageRequestBody),
        });

        if (imageResponse.ok) {
          const imageData = await imageResponse.json();
          
          if (isVertexAIImage) {
            // Vertex AI Imagen response
            const prediction = imageData.predictions?.[0];
            if (prediction?.bytesBase64Encoded) {
              imageUrl = `data:image/png;base64,${prediction.bytesBase64Encoded}`;
              console.log('Vertex AI Imagen: image generated successfully');
            } else if (prediction?.mimeType && prediction?.bytesBase64Encoded) {
              imageUrl = `data:${prediction.mimeType};base64,${prediction.bytesBase64Encoded}`;
              console.log('Vertex AI Imagen: image with mimeType generated');
            }
          } else {
            // OpenAI/Generic format
            imageUrl = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
          }
          
          console.log('Image generated:', !!imageUrl);
        } else {
          console.error('Image generation failed:', imageResponse.status);
        }
      } else {
        console.log('Image generation service not configured or inactive');
      }
    }

    // Deduct cost from bonus balance
    const { error: updateError } = await supabaseClient
      .from('profiles')
      .update({ bonus_balance: profile.bonus_balance - totalCost })
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
        type: 'ai_post_generation',
        amount: -totalCost,
        status: 'completed',
        description: isVip && (textDiscountPercent > 0 || (withImage && imageDiscountPercent > 0))
          ? `Генерація посту AI${withImage ? ' з зображенням' : ''} (VIP знижка: ${originalTotalCost.toFixed(2)}₴ → ${totalCost.toFixed(2)}₴)`
          : `Генерація посту AI${withImage ? ' з зображенням' : ''}`,
        metadata: { 
          prompt, 
          with_image: withImage, 
          from_bonus: true,
          is_vip: isVip,
          original_price: originalTotalCost,
          text_discount_percent: textDiscountPercent,
          image_discount_percent: imageDiscountPercent,
          final_price: totalCost,
          text_price: postTextPrice,
          image_price: withImage ? postImagePrice : 0
        }
      });

    if (transactionError) {
      console.error('Error creating transaction:', transactionError);
    }

    console.log('Post generated successfully');

    return new Response(
      JSON.stringify({ 
        text: postText,
        imageUrl: imageUrl || undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in generate-post function:', error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
