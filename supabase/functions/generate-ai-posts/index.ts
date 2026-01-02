import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.83.0';
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { serviceId, count = 1 } = await req.json();

    if (!serviceId) {
      return new Response(
        JSON.stringify({ error: 'serviceId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Load AI bot service
    const { data: service, error: serviceError } = await supabase
      .from('ai_bot_services')
      .select('*')
      .eq('id', serviceId)
      .single();

    if (serviceError || !service) {
      console.error('Service not found:', serviceError);
      return new Response(
        JSON.stringify({ error: 'AI сервіс не знайдено' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    // Load active categories for this service
    const { data: sources, error: sourcesError } = await supabase
      .from('ai_content_sources')
      .select('*')
      .eq('ai_bot_service_id', serviceId)
      .eq('source_type', 'category')
      .eq('is_active', true);

    // Load publishing settings to check for custom prompt and media
    const { data: settings } = await supabase
      .from('ai_publishing_settings')
      .select('use_custom_prompt, custom_prompt, include_media, generate_tags')
      .eq('ai_bot_service_id', serviceId)
      .single();

    const useCustomPrompt = settings?.use_custom_prompt ?? false;
    const customPromptText = settings?.custom_prompt || '';
    const includeMedia = settings?.include_media ?? false;
    const generateTags = settings?.generate_tags ?? false;

    if (!useCustomPrompt) {
      if (sourcesError) {
        console.error('Sources error:', sourcesError);
        return new Response(
          JSON.stringify({ error: 'Помилка завантаження категорій' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }

      if (!sources || sources.length === 0) {
        return new Response(
          JSON.stringify({ error: 'Оберіть хоча б одну категорію' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }
    }

    // Load AI service settings from database
    const { data: textService, error: textServiceError } = await supabase
      .from('ai_service_settings')
      .select('*')
      .eq('service_name', 'text_generation')
      .eq('is_active', true)
      .single();

    if (textServiceError || !textService) {
      console.error('Text generation service not configured:', textServiceError);
      return new Response(
        JSON.stringify({ error: 'AI сервіс для генерації тексту не налаштовано в адмінці' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    if (!textService.api_key) {
      console.error('Text generation API key not configured');
      return new Response(
        JSON.stringify({ error: 'API ключ не налаштовано. Перейдіть в Адмін → AI Сервіси' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
      );
    }

    const categoryLabels: Record<string, string> = {
      news: 'Новини',
      tech: 'Технології',
      fantasy: 'Фантастика',
      business: 'Бізнес',
      lifestyle: 'Стиль життя',
      science: 'Наука',
      education: 'Освіта',
      health: "Здоров'я",
      fitness: 'Фітнес',
      food: 'Їжа та кулінарія',
      travel: 'Подорожі',
      motivation: 'Мотивація',
      entertainment: 'Розваги',
      gaming: 'Ігри',
      crypto: 'Криптовалюта',
      finance: 'Фінанси',
      psychology: 'Психологія',
      art: 'Мистецтво',
      music: 'Музика',
      sport: 'Спорт',
    };

    // Load category prompts from database
    const { data: categoryPrompts } = await supabase
      .from('category_prompts')
      .select('category_name, custom_prompt, use_custom_prompt')
      .eq('use_custom_prompt', true);

    const categoryPromptsMap: Record<string, string> = {};
    if (categoryPrompts) {
      categoryPrompts.forEach(cp => {
        categoryPromptsMap[cp.category_name] = cp.custom_prompt;
      });
    }

    const generatedPosts: any[] = [];
    
    console.log(`Starting generation of ${count} posts for service ${serviceId}`);

    for (let i = 0; i < count; i++) {
      console.log(`\n=== Generating post ${i + 1}/${count} ===`);
      let category = '';
      let categoryName = '';
      let keywords: string[] = [];
      let prompt = '';

      if (useCustomPrompt) {
        category = 'custom';
        categoryName = 'власний промт';
        const tagsRequirement = generateTags ? '- 2-4 релевантні хештеги в кінці\n' : '';
        prompt = `${customPromptText}

Вимоги:
- Обсяг 300-500 символів
- Природний живий стиль
- Декілька доречних емодзі
${tagsRequirement}- Українська мова
- Поверни ТІЛЬКИ текст посту без додаткових пояснень.`;
      } else {
        if (!sources || sources.length === 0) {
          console.error('No sources available');
          continue;
        }
        // Pick random source
        const source = sources[Math.floor(Math.random() * sources.length)];
        category = source.category as string;
        categoryName = categoryLabels[category] || category || 'універсальна тема';
        keywords = (source.keywords as string[] | null) ?? [];
        
        // Check if category has custom prompt in database
        const customCategoryPrompt = categoryPromptsMap[categoryName];
        
        const tagsRequirement = generateTags ? '- 2-4 релевантні хештеги в кінці\n' : '';
        
        if (customCategoryPrompt) {
          // Use custom prompt from database
          console.log(`Using custom prompt from DB for category: ${categoryName}`);
          prompt = `${customCategoryPrompt}

Вимоги:
- Обсяг 300-500 символів
- Природний живий стиль
- Декілька доречних емодзі
${tagsRequirement}- Українська мова
- Поверни ТІЛЬКИ текст посту без додаткових пояснень.`;
        } else {
          // Use default prompt
          const keywordStr = keywords.length > 0 ? ` Ключові слова: ${keywords.join(', ')}` : '';
          prompt = `Створи короткий, але змістовний пост для Telegram-каналу на тему "${categoryName}".${keywordStr}

Вимоги:
- Обсяг 300-500 символів
- Природний живий стиль
- Декілька доречних емодзі
${tagsRequirement}- Українська мова
- Поверни ТІЛЬКИ текст посту без додаткових пояснень.`;
        }
      }

      console.log('Generating post for category:', categoryName);
      console.log('Using AI service:', textService.provider, 'Model:', textService.model_name);
      console.log('Prompt:', prompt.substring(0, 200) + '...');

      // Check if this is Vertex AI
      const isVertexAI = textService.provider?.toLowerCase().includes('vertex') || 
                         textService.api_endpoint?.includes('aiplatform.googleapis.com');

      let requestBody: any;
      const requestHeaders: any = {
        'Content-Type': 'application/json; charset=utf-8',
      };

      if (isVertexAI) {
        // Vertex AI Gemini format
        const accessToken = await getVertexAIToken(textService.api_key);
        requestHeaders['Authorization'] = `Bearer ${accessToken}`;
        
        requestBody = {
          contents: [{
            role: "user",
            parts: [{
              text: `Ти генератор контенту для Telegram-каналу. Повертай тільки готовий текст посту без пояснень, коментарів чи форматування Markdown.\n\n${prompt}`
            }]
          }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 1024
          }
        };
      } else {
        // OpenAI/Generic format
        requestHeaders['Authorization'] = `Bearer ${textService.api_key}`;
        
        requestBody = {
          model: textService.model_name,
          messages: [
            {
              role: 'system',
              content: 'Ти генератор контенту для Telegram-каналу. Повертай тільки готовий текст посту без пояснень, коментарів чи форматування Markdown.',
            },
            { role: 'user', content: prompt },
          ],
        };
      }

      const aiResponse = await fetch(textService.api_endpoint, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(requestBody),
      });

      if (!aiResponse.ok) {
        const text = await aiResponse.text();
        console.error('AI gateway error:', aiResponse.status, text);

        if (aiResponse.status === 429) {
          return new Response(
            JSON.stringify({ error: 'Перевищено ліміт AI-запитів. Спробуйте пізніше.' }),
            { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
          );
        }

        if (aiResponse.status === 402) {
          return new Response(
            JSON.stringify({ error: 'Недостатньо кредитів для AI. Поповніть баланс у Lovable.' }),
            { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
          );
        }

        return new Response(
          JSON.stringify({ error: 'Помилка AI сервісу' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
        );
      }

      const aiData = await aiResponse.json();
      console.log('AI response data:', JSON.stringify(aiData).substring(0, 200));
      
      let content: string | undefined;
      if (isVertexAI) {
        // Vertex AI Gemini response
        content = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
      } else {
        // OpenAI/Generic response
        content = aiData.choices?.[0]?.message?.content;
      }

      if (!content) {
        console.error('Empty AI content, full response:', JSON.stringify(aiData));
        continue;
      }

      console.log('Generated content length:', content.length);
      console.log('Generated content preview:', content.substring(0, 100) + '...');

      // Generate image if includeMedia is enabled
      let imageUrl: string | undefined = undefined;
      if (includeMedia) {
        try {
          // Load image generation service
          const { data: imageService } = await supabase
            .from('ai_service_settings')
            .select('*')
            .eq('service_name', 'image_generation')
            .eq('is_active', true)
            .single();

          if (imageService && imageService.api_key) {
            const imagePrompt = `Створи яскраве та привабливе зображення для Telegram-посту на тему: ${categoryName || 'загальна тема'}. Зображення має бути візуально привабливим та відповідати змісту.`;
            
            console.log('Starting image generation for category:', categoryName);
            console.log('Using image service:', imageService.provider, 'Model:', imageService.model_name);
            
            // Check if this is Vertex AI
            const isVertexAIImage = imageService.provider?.toLowerCase().includes('vertex') || 
                                    imageService.api_endpoint?.includes('aiplatform.googleapis.com');

            let apiUrl = imageService.api_endpoint;
            let requestBody: any;
            let requestHeaders: any = {
              'Content-Type': 'application/json; charset=utf-8',
            };

            if (isVertexAIImage) {
              // Vertex AI Imagen format
              const accessToken = await getVertexAIToken(imageService.api_key);
              requestHeaders['Authorization'] = `Bearer ${accessToken}`;
              
              requestBody = {
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
              requestHeaders['Authorization'] = `Bearer ${imageService.api_key}`;
              
              requestBody = {
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
            
            const imageResponse = await fetch(apiUrl, {
              method: 'POST',
              headers: requestHeaders,
              body: JSON.stringify(requestBody)
            });

            if (imageResponse.ok) {
              const imageData = await imageResponse.json();
              console.log('Image API response received');
              
              let generatedImage: string | null = null;

              if (isVertexAIImage) {
                // Vertex AI Imagen response format
                const prediction = imageData.predictions?.[0];
                if (prediction?.bytesBase64Encoded) {
                  generatedImage = `data:image/png;base64,${prediction.bytesBase64Encoded}`;
                  console.log('Vertex AI Imagen: image generated successfully');
                } else if (prediction?.mimeType && prediction?.bytesBase64Encoded) {
                  generatedImage = `data:${prediction.mimeType};base64,${prediction.bytesBase64Encoded}`;
                  console.log('Vertex AI Imagen: image with mimeType generated successfully');
                }
              } else {
                // OpenAI/Generic format
                generatedImage = imageData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
              }

              if (generatedImage) {
                imageUrl = generatedImage;
                console.log('Image generated successfully, length:', generatedImage.length);
              } else {
                console.log('No image in response');
              }
            } else {
              const errorText = await imageResponse.text();
              console.error('Image generation failed:', imageResponse.status, errorText);
            }
          } else {
            console.log('Image generation service not active or not configured');
          }
        } catch (imageError) {
          console.error('Error generating image:', imageError);
          // Continue without image if generation fails
        }
      }

      console.log('Attempting to insert post...');
      console.log('Data:', {
        ai_bot_service_id: serviceId,
        category,
        content_length: content.trim().length,
        has_image: !!imageUrl,
        status: 'scheduled'
      });

      const { data: inserted, error: insertError } = await supabase
        .from('ai_generated_posts')
        .insert({
          ai_bot_service_id: serviceId,
          category,
          content: content.trim(),
          image_url: imageUrl,
          status: 'scheduled',
        })
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        console.error('Insert error details:', JSON.stringify(insertError));
        continue;
      }

      console.log('Post inserted successfully:', inserted.id);
      generatedPosts.push(inserted);
    }

    console.log(`\n=== Generation complete: ${generatedPosts.length}/${count} posts created ===`);

    return new Response(
      JSON.stringify({ posts: generatedPosts }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    );
  } catch (error) {
    console.error('generate-ai-posts error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json; charset=utf-8' } }
    );
  }
});
