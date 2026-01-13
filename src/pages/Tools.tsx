import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { BonusBalanceDisplay } from "@/components/BonusBalanceDisplay";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { Sparkles, Loader2, Download, Clock, FileText, Copy, Send, Image as ImageIcon, ArrowLeft, CheckCircle2, XCircle, Pencil, Check, X, MessageSquare, DollarSign, TrendingUp } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { CategorySelector, CategoryOption } from "@/components/CategorySelector";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NeuroPromotion } from "@/components/NeuroPromotion";

type ToolView = "main" | "image-generation" | "post-generation";

export default function Tools() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [currentView, setCurrentView] = useState<ToolView>("main");
  const [profile, setProfile] = useState<any>(null);
  const [postCategories, setPostCategories] = useState<CategoryOption[]>([]);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingProgress, setGeneratingProgress] = useState("");
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [imageGenSteps, setImageGenSteps] = useState<string[]>([]);
  const [imageGenCurrentStep, setImageGenCurrentStep] = useState(0);
  const [showImageResult, setShowImageResult] = useState(false);
  const [aiToolEnabled, setAiToolEnabled] = useState(false);
  const [aiPostToolEnabled, setAiPostToolEnabled] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState(20);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  
  // Автоматично приховуємо результат коли час вийшов
  useEffect(() => {
    if (timeRemaining === 0 && showImageResult) {
      setShowImageResult(false);
      setGeneratedImage(null);
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
    }
  }, [timeRemaining, showImageResult, timerInterval]);
  
  // Post generation states
  const [postInputType, setPostInputType] = useState<"category" | "custom">("category");
  const [postTopic, setPostTopic] = useState<string>("");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [withImage, setWithImage] = useState(false);
  const [withTags, setWithTags] = useState(false);
  const [isGeneratingPost, setIsGeneratingPost] = useState(false);
  const [generatingPostProgress, setGeneratingPostProgress] = useState("");
  const [generatedPost, setGeneratedPost] = useState<{ text: string; imageUrl?: string } | null>(null);
  const [postGenSteps, setPostGenSteps] = useState<string[]>([]);
  const [postGenCurrentStep, setPostGenCurrentStep] = useState(0);
  const [showPostResult, setShowPostResult] = useState(false);
  const [aiPricing, setAiPricing] = useState({ imagePrice: 5, postTextPrice: 5, postImagePrice: 2 });
  const [isVip, setIsVip] = useState(false);
  const [isEditingText, setIsEditingText] = useState(false);
  const [editedText, setEditedText] = useState("");
  const [showChannelDialog, setShowChannelDialog] = useState(false);
  const [userChannels, setUserChannels] = useState<any[]>([]);
  const [channelInfo, setChannelInfo] = useState<Record<string, any>>({});
  const [isPublishing, setIsPublishing] = useState(false);
  const [toolsSettings, setToolsSettings] = useState<Record<string, any>>({});
  const [showNeuroPromotion, setShowNeuroPromotion] = useState(false);

  useEffect(() => {
    loadCategories();
    loadProfile();
    loadToolsSettings();
    checkAiToolStatus();
    loadAiPricing();
    checkVipStatus();

    // Підписка на реал-тайм зміни AI налаштувань
    const channel = supabase
      .channel('ai_settings_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'app_settings',
          filter: 'key=in.(ai_image_tool_enabled,ai_post_tool_enabled,ai_pricing)',
        },
        () => {
          checkAiToolStatus();
          loadAiPricing();
        }
      )
      .subscribe();
    
    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
      supabase.removeChannel(channel);
    };
  }, [timerInterval]);

  const loadCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('category_prompts')
        .select('category_key, category_name, emoji')
        .order('category_name');

      if (error) {
        console.error('Error loading categories:', error);
        return;
      }

      if (data) {
        const categories: CategoryOption[] = data
          .filter(cat => cat.category_key && cat.category_key.trim() !== '')
          .map(cat => ({
            value: cat.category_key,
            label: cat.category_name,
            emoji: cat.emoji || '📝'
          }));
        
        console.log('Loaded categories:', categories.length, categories);
        setPostCategories(categories);
        
        // Show warning if some categories are missing category_key
        const missingKeys = data.filter(cat => !cat.category_key || cat.category_key.trim() === '');
        if (missingKeys.length > 0) {
          console.warn('Categories without category_key:', missingKeys.map(c => c.category_name));
        }
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    setProfile(data);
  };

  const loadToolsSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('tools_settings')
        .select('*');
      
      if (error) throw error;
      
      // Конвертуємо в об'єкт для швидкого доступу
      const settingsMap: Record<string, any> = {};
      data?.forEach(tool => {
        settingsMap[tool.tool_key] = tool;
      });
      
      setToolsSettings(settingsMap);
    } catch (error) {
      console.error('Error loading tools settings:', error);
    }
  };

  const checkAiToolStatus = async () => {
    const { data: imageToolData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_image_tool_enabled")
      .single();

    if (imageToolData) {
      setAiToolEnabled(imageToolData.value as boolean);
    }
    
    const { data: postToolData } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_post_tool_enabled")
      .single();

    if (postToolData) {
      setAiPostToolEnabled(postToolData.value as boolean);
    }
  };

  const loadAiPricing = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "ai_pricing")
      .single();

    if (data?.value) {
      setAiPricing(data.value as any);
    }
  };

  const checkVipStatus = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    const { data } = await supabase
      .from("vip_subscriptions")
      .select("expires_at")
      .eq("user_id", session.user.id)
      .gt("expires_at", new Date().toISOString())
      .single();

    setIsVip(!!data);
  };

  const getVipPrice = (price: number, toolKey?: string) => {
    if (!isVip) return price;
    
    if (toolKey) {
      const tool = toolsSettings[toolKey];
      if (!tool?.vip_discount_enabled) return price;
      
      const discount = tool.vip_discount_percent || 50;
      return price * (1 - discount / 100);
    }
    
    // Fallback для старих викликів без toolKey
    return price * 0.5;
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast({
        title: "Помилка",
        description: "Будь ласка, введіть опис зображення",
        variant: "destructive",
      });
      return;
    }

    if (!aiToolEnabled) {
      toast({
        title: "Інструмент недоступний",
        description: "Генерація зображень тимчасово відключена",
        variant: "destructive",
      });
      return;
    }

    const imagePrice = toolsSettings['image_generation']?.price || 5;
    const finalPrice = getVipPrice(imagePrice, 'image_generation');
    if (!profile || profile.bonus_balance < finalPrice) {
      toast({
        title: "Недостатньо коштів",
        description: `Для генерації потрібно ${finalPrice} бонусних гривень`,
        variant: "destructive",
      });
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setShowImageResult(false);
    setGeneratingProgress("Підготовка промпту...");
    
    // Розширені кроки генерації зображення
    const steps = [
      "Аналіз вашого запиту...",
      "Підготовка промпту...",
      "Оптимізація параметрів...",
      "Підключення до AI сервісу...",
      "Генерація зображення...",
      "Застосування стилізації...",
      "Покращення якості...",
      "Фінальна обробка..."
    ];
    setImageGenSteps(steps);
    setImageGenCurrentStep(0);

    // Анімація кроків
    const stepInterval = setInterval(() => {
      setImageGenCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          setGeneratingProgress(steps[prev + 1]);
          return prev + 1;
        }
        return prev;
      });
    }, 3000); // Кожні 3 секунди новий крок

    try {
      // Покращуємо та перекладаємо промпт в фоновому режимі
      let enhancedPrompt = prompt;
      try {
        // Використовуємо text_generation сервіс для покращення промпту
        const { data: textService } = await supabase
          .from('ai_service_settings')
          .select('*')
          .eq('service_name', 'text_generation')
          .eq('is_active', true)
          .single();

        if (textService) {
          // Використовуємо AI для покращення промпту
          const improvementPrompt = `You are an expert prompt engineer for AI image generation. Transform the user's simple prompt into a detailed, professional prompt that will generate stunning, high-quality images.

RULES:
1. Translate to English but keep ANY text in quotes/inscriptions in ORIGINAL language (Ukrainian/Cyrillic)
2. Add specific visual details: lighting, colors, composition, camera angle, style
3. Include quality markers: "high quality", "detailed", "professional", "4k", "sharp focus"
4. Specify art style if appropriate: photorealistic, digital art, illustration, etc.
5. Add mood and atmosphere descriptions
6. Keep it under 75 words but make every word count
7. Be specific about what you want to see

Examples:
Input: "кіт на даху"
Output: "A majestic orange tabby cat sitting gracefully on a red clay tiled roof during golden hour sunset, warm cinematic lighting, detailed fur texture, photorealistic, professional photography, bokeh background, 4k, sharp focus"

Input: "аватар з надписом Новини"
Output: "Modern minimalist avatar design with bold text 'Новини' in Ukrainian, clean typography, professional branding, vibrant blue and yellow gradient background, sharp vector graphics, 4k resolution, centered composition"

Input: "логотип кав'ярні"
Output: "Elegant coffee shop logo design, featuring a steaming coffee cup silhouette, warm brown and cream colors, minimalist modern style, clean lines, professional branding, vector graphics, suitable for signage"

User's prompt: "${prompt}"

Return ONLY the enhanced English prompt (keeping any Ukrainian text unchanged). No explanations.`;

          // Викликаємо AI API напряму
          const response = await fetch(textService.api_endpoint, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${textService.api_key}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: textService.model_name,
              messages: [
                {
                  role: 'user',
                  content: improvementPrompt
                }
              ],
              temperature: 0.8,
              max_tokens: 200,
            }),
          });

          if (response.ok) {
            const data = await response.json();
            const improvedText = data.choices?.[0]?.message?.content?.trim();
            
            if (improvedText) {
              enhancedPrompt = improvedText.replace(/^["']|["']$/g, '');
            }
          }
        }
      } catch (enhanceError) {
        console.warn('Prompt enhancement failed, using original:', enhanceError);
      }

      setGeneratingProgress("Генерація зображення... Це може зайняти 10-60 секунд");

      // Retry механізм з експоненційною затримкою
      let attempt = 0;
      const maxAttempts = 3;
      let lastError: any = null;

      while (attempt < maxAttempts) {
        try {
          const { data, error } = await supabase.functions.invoke("generate-image", {
            body: { prompt: enhancedPrompt },
          });

          if (!error && !data?.error) {
            // Успіх!
            if (data?.imageUrl) {
              setGeneratedImage(data.imageUrl);
              setShowImageResult(true);
              
              // Запускаємо таймер на 20 секунд
              setTimeRemaining(20);
              const interval = setInterval(() => {
                setTimeRemaining((prev) => {
                  if (prev <= 1) {
                    clearInterval(interval);
                    return 0;
                  }
                  return prev - 1;
                });
              }, 1000);
              setTimerInterval(interval);
              
              // Reload profile balance
              const { data: updatedProfile } = await supabase
                .from('profiles')
                .select('bonus_balance')
                .eq('id', profile.id)
                .single();
              
              if (updatedProfile) {
                setProfile({ ...profile, bonus_balance: updatedProfile.bonus_balance });
              }
              
              toast({
                title: "Успішно",
                description: "Зображення згенеровано!",
              });
            }
            return; // Вихід з циклу при успіху
          }

          // Помилка від API
          lastError = error || new Error(data.error);

          // Якщо помилка 429 (rate limit) або 503 (service unavailable) - retry
          if (error?.status === 429 || error?.status === 503 || 
              data?.error?.includes('rate limit') || data?.error?.includes('quota')) {
            attempt++;
            if (attempt < maxAttempts) {
              const waitTime = Math.pow(2, attempt) * 2000; // 4s, 8s, 16s
              setGeneratingProgress(`Сервер зайнятий. Повторна спроба через ${waitTime/1000} сек... (${attempt}/${maxAttempts})`);
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }

          // Інші помилки - виходимо
          throw lastError;

        } catch (retryError) {
          lastError = retryError;
          if (attempt === maxAttempts - 1) {
            throw retryError;
          }
          attempt++;
          const waitTime = Math.pow(2, attempt) * 2000;
          setGeneratingProgress(`Помилка. Повторна спроба через ${waitTime/1000} сек... (${attempt}/${maxAttempts})`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // Якщо всі спроби вичерпані
      throw lastError || new Error("Перевищено ліміт спроб");
    } catch (error: any) {
      console.error("Error generating image:", error);
      console.error("Error details:", {
        message: error.message,
        name: error.name,
        stack: error.stack,
        context: error.context
      });
      
      let errorMessage = error.message || "Не вдалося згенерувати зображення";
      
      // Add more context for common errors
      if (error.message?.includes("non-2xx status code")) {
        errorMessage = "Помилка Edge Function. Перевір: 1) Endpoint правильний? 2) API key валідний? 3) Функція задеплоєна? Детальніше в консолі F12.";
      }
      
      toast({
        title: "Помилка генерації",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      clearInterval(stepInterval);
      setIsGenerating(false);
      setImageGenSteps([]);
      setImageGenCurrentStep(0);
    }
  };

  const handleGeneratePost = async () => {
    const prompt = postInputType === "category" ? postTopic : customPrompt;
    
    if (!prompt.trim()) {
      toast({
        title: "Помилка",
        description: postInputType === "category" ? "Будь ласка, виберіть категорію" : "Будь ласка, введіть промпт",
        variant: "destructive",
      });
      return;
    }

    if (!aiPostToolEnabled) {
      toast({
        title: "Інструмент недоступний",
        description: "Генерація постів тимчасово відключена",
        variant: "destructive",
      });
      return;
    }

    const postPrice = toolsSettings['post_generation']?.price || 5;
    const cost = getVipPrice(postPrice, 'post_generation');
    if (!profile || profile.bonus_balance < cost) {
      toast({
        title: "Недостатньо коштів",
        description: `Для генерації потрібно ${cost} бонусних гривень`,
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingPost(true);
    setGeneratedPost(null);
    setShowPostResult(false);
    setGeneratingPostProgress("Генерація тексту посту...");
    
    // Розширені кроки генерації посту
    const steps = [
      "Аналіз теми публікації...",
      "Генерація тексту посту...",
      "Підбір ключових слів...",
      "Оптимізація структури...",
      "Перевірка унікальності...",
      "Додавання емодзі...",
      withTags ? "Генерація хештегів..." : null,
      withImage ? "Створення зображення..." : null,
      "Фінальне оформлення..."
    ].filter(Boolean) as string[];
    
    setPostGenSteps(steps);
    setPostGenCurrentStep(0);

    // Анімація кроків
    const stepInterval = setInterval(() => {
      setPostGenCurrentStep((prev) => {
        if (prev < steps.length - 1) {
          setGeneratingPostProgress(steps[prev + 1]);
          return prev + 1;
        }
        return prev;
      });
    }, 2500); // Кожні 2.5 секунди новий крок

    try {
      // Спочатку генеруємо текст посту
      console.log("Calling generate-post function...", { prompt, withImage: false, withTags });
      
      // Генеруємо тільки текст (без зображення)
      const { data, error } = await supabase.functions.invoke("generate-post", {
        body: { prompt, withImage: false, withTags },
      });

      console.log("Function response:", { data, error });

      if (error) {
        console.error("Supabase function error:", error);
        throw new Error(`Function error: ${error.message || JSON.stringify(error)}`);
      }

      if (data?.error) {
        console.error("API error in response:", data.error);
        throw new Error(data.error);
      }

      const postText: string | undefined = data?.post ?? data?.text;

      if (!postText) {
        console.error("No post in response:", data);
        throw new Error("Відповідь не містить згенерованого тексту");
      }

      let imageUrl: string | undefined;
      
      // Якщо користувач хоче зображення, генеруємо його окремо
      if (withImage) {
        setGeneratingPostProgress("Генерація зображення до посту... Це може зайняти 10-60 секунд");
        
        try {
          // Створюємо промпт для зображення на основі тексту посту
          const imagePrompt = postText.substring(0, 200); // Перші 200 символів як промпт
          
          const { data: imageData, error: imageError } = await supabase.functions.invoke("generate-image", {
            body: { prompt: imagePrompt },
          });
          
          if (imageError) {
            console.error("Image generation error:", imageError);
            toast({
              title: "Увага",
              description: "Текст посту створено, але не вдалося згенерувати зображення",
              variant: "destructive",
            });
          } else if (imageData?.imageUrl) {
            imageUrl = imageData.imageUrl;
          }
        } catch (imageErr) {
          console.error("Image generation failed:", imageErr);
        }
      }

      setGeneratedPost({ text: postText, imageUrl });
      setShowPostResult(true);
      
      await loadProfile();

      const postPrice = toolsSettings['post_generation']?.price || 10;
      const imagePrice = withImage && imageUrl ? (toolsSettings['post_image']?.price || 3) : 0;
      const totalPrice = getVipPrice(postPrice, 'post_generation') + (imageUrl ? getVipPrice(imagePrice, 'post_image') : 0);
      
      toast({
        title: "Успішно",
        description: withImage && imageUrl
          ? `Пост та зображення згенеровано! З вашого балансу списано ${totalPrice.toFixed(2)}₴`
          : `Пост згенеровано! З вашого балансу списано ${totalPrice.toFixed(2)}₴`,
      });
    } catch (error: any) {
      console.error("Error generating post:", error);
      
      let errorMessage = "Не вдалося згенерувати пост";
      if (error.message) {
        errorMessage = error.message;
      } else if (error.name === "FunctionsHttpError") {
        errorMessage = "Edge Function недоступна. Можливо API ключі не налаштовані або функція не задеплоєна";
      }
      
      toast({
        title: "Помилка генерації",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      clearInterval(stepInterval);
      setIsGeneratingPost(false);
      setPostGenSteps([]);
      setPostGenCurrentStep(0);
    }
  };

  const resetImageGeneration = () => {
    setShowImageResult(false);
    setGeneratedImage(null);
    setPrompt("");
    if (timerInterval) {
      clearInterval(timerInterval);
      setTimerInterval(null);
    }
  };

  const resetPostGeneration = () => {
    setShowPostResult(false);
    setGeneratedPost(null);
    setPostTopic("");
    setCustomPrompt("");
    setWithImage(false);
    setWithTags(false);
  };

  const copyPostText = () => {
    const textToCopy = isEditingText ? editedText : generatedPost?.text;
    if (textToCopy) {
      navigator.clipboard.writeText(textToCopy);
      toast({
        title: "Скопійовано",
        description: "Текст посту скопійовано в буфер обміну",
      });
    }
  };

  const downloadPostImage = () => {
    if (generatedPost?.imageUrl) {
      const link = document.createElement("a");
      link.href = generatedPost.imageUrl;
      link.download = `post-image-${Date.now()}.png`;
      link.click();
      toast({
        title: "Завантажено",
        description: "Зображення успішно завантажено",
      });
    }
  };

  const downloadImage = () => {
    if (generatedImage) {
      const link = document.createElement("a");
      link.href = generatedImage;
      link.download = `image-${Date.now()}.png`;
      link.click();
      toast({
        title: "Завантажено",
        description: "Зображення успішно завантажено",
      });
    }
  };

  const loadUserChannels = async () => {
    if (!profile?.id) return [];

    // Отримати канали з підключеними ботами (plagiarist та AI)
    const [plagiaristResult, aiResult] = await Promise.all([
      supabase
        .from('bot_services')
        .select(`
          id, 
          target_channel, 
          bot_id,
          telegram_bots!inner(id, bot_token, bot_username, is_active)
        `)
        .eq('user_id', profile.id)
        .not('bot_id', 'is', null),
      supabase
        .from('ai_bot_services')
        .select(`
          id, 
          target_channel, 
          bot_id,
          telegram_bots!inner(id, bot_token, bot_username, is_active)
        `)
        .eq('user_id', profile.id)
        .not('bot_id', 'is', null)
    ]);

    const plagiaristChannels = (plagiaristResult.data || []).map(c => ({ ...c, serviceType: 'plagiarist' }));
    const aiChannels = (aiResult.data || []).map(c => ({ ...c, serviceType: 'ai' }));
    
    // Фільтруємо дублі за target_channel
    const channelMap = new Map();
    [...plagiaristChannels, ...aiChannels].forEach(channel => {
      const key = channel.target_channel.toLowerCase().replace('@', '');
      if (!channelMap.has(key)) {
        channelMap.set(key, channel);
      }
    });
    
    const channels = Array.from(channelMap.values());
    setUserChannels(channels);
    return channels;
  };

  const openPublishDialog = async () => {
    if (!generatedPost?.text && !generatedPost?.imageUrl) {
      toast({
        title: "Помилка",
        description: "Немає контенту для публікації",
        variant: "destructive",
      });
      return;
    }

    if (!profile?.id) return;

    // Завантажити канали з ботами (plagiarist та AI)
    const [plagiaristResult, aiResult] = await Promise.all([
      supabase
        .from('bot_services')
        .select(`
          id, 
          target_channel, 
          bot_id,
          telegram_bots!inner(id, bot_token, bot_username, is_active)
        `)
        .eq('user_id', profile.id)
        .not('bot_id', 'is', null),
      supabase
        .from('ai_bot_services')
        .select(`
          id, 
          target_channel, 
          bot_id,
          telegram_bots!inner(id, bot_token, bot_username, is_active)
        `)
        .eq('user_id', profile.id)
        .not('bot_id', 'is', null)
    ]);

    // Об'єднати канали з обох таблиць, уникаючи дублів за target_channel
    const plagiaristChannels = (plagiaristResult.data || []).map(c => ({ ...c, serviceType: 'plagiarist' }));
    const aiChannels = (aiResult.data || []).map(c => ({ ...c, serviceType: 'ai' }));
    
    // Фільтруємо дублі за target_channel (пріоритет AI ботам)
    const channelMap = new Map();
    [...plagiaristChannels, ...aiChannels].forEach(channel => {
      const key = channel.target_channel.toLowerCase().replace('@', '');
      if (!channelMap.has(key)) {
        channelMap.set(key, channel);
      }
    });
    
    const channels = Array.from(channelMap.values());
    setUserChannels(channels);

    if (channels.length === 0) {
      toast({
        title: "Канал не налаштований",
        description: "Спочатку додайте канал з підключеним ботом в розділі 'Мої канали'",
        variant: "destructive",
      });
      return;
    }

    // Завантажити інформацію про канали в фоні
    loadChannelInfo(channels).catch(err => console.log("Channel info loading failed:", err));
    setShowChannelDialog(true);
  };

  const loadChannelInfo = async (channels: any[]) => {
    try {
      const info: Record<string, any> = {};

      for (const channel of channels) {
        try {
          // Використовуємо бота підключеного до цього каналу
          const botToken = channel.telegram_bots?.bot_token;
          if (!botToken) continue;

          const cleanChannel = channel.target_channel.replace('@', '');
          const response = await fetch(
            `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${cleanChannel}`
          );
          const result = await response.json();

          if (result.ok) {
            info[channel.id] = {
              title: result.result.title || channel.target_channel,
              username: result.result.username || cleanChannel,
              photo: null,
              botUsername: channel.telegram_bots?.bot_username
            };

            // Завантажити аватар якщо є
            if (result.result.photo?.big_file_id) {
              const photoResponse = await fetch(
                `https://api.telegram.org/bot${botToken}/getFile?file_id=${result.result.photo.big_file_id}`
              );
              const photoData = await photoResponse.json();
              
              if (photoData.ok) {
                info[channel.id].photo = `https://api.telegram.org/file/bot${botToken}/${photoData.result.file_path}`;
              }
            }
          }
        } catch (error) {
          console.error(`Error loading info for channel ${channel.target_channel}:`, error);
        }
      }

      setChannelInfo(info);
    } catch (error) {
      console.error("Error loading channel info:", error);
    }
  };

  const publishToChannel = async (channel: any) => {
    // Отримуємо бота підключеного до цього каналу
    const botToken = channel.telegram_bots?.bot_token;
    const botUsername = channel.telegram_bots?.bot_username;
    const targetChannel = channel.target_channel;

    if (!botToken) {
      toast({
        title: "Бот не підключений",
        description: "До цього каналу не підключено бота",
        variant: "destructive",
      });
      return;
    }

    const textToPublish = isEditingText ? editedText : generatedPost?.text || "";

    if (!textToPublish && !generatedPost?.imageUrl) {
      toast({
        title: "Помилка",
        description: "Немає контенту для публікації",
        variant: "destructive",
      });
      return;
    }

    setIsPublishing(true);

    try {
      const { data, error } = await supabase.functions.invoke("publish-to-telegram", {
        body: { 
          text: textToPublish, 
          imageUrl: generatedPost?.imageUrl || null,
          botToken: botToken,
          targetChannel: targetChannel
        },
      });

      if (error) throw error;

      if (data?.error) {
        throw new Error(data.error);
      }

      setShowChannelDialog(false);
      
      toast({
        title: "Успішно опубліковано",
        description: `Пост опубліковано в канал ${targetChannel} через бота @${botUsername || 'вашого бота'}`,
      });

      // Очистити генерований пост після успішної публікації
      setTimeout(() => {
        resetPostGeneration();
      }, 1500);

    } catch (error: any) {
      console.error("Error publishing to Telegram:", error);
      
      let errorMessage = "Не вдалося опублікувати в Telegram";
      
      if (error.message?.includes("chat not found")) {
        errorMessage = "Канал не знайдено. Перевірте правильність назви каналу та додайте бота як адміністратора";
      } else if (error.message?.includes("bot was kicked")) {
        errorMessage = "Бота видалено з каналу. Додайте бота назад як адміністратора";
      } else if (error.message?.includes("not enough rights")) {
        errorMessage = "Бот не має прав для публікації. Надайте боту права адміністратора в каналі";
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast({
        title: "Помилка публікації",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsPublishing(false);
    }
  };

  const startEditingText = () => {
    setEditedText(generatedPost?.text || "");
    setIsEditingText(true);
  };

  const saveEditedText = () => {
    if (generatedPost) {
      setGeneratedPost({ ...generatedPost, text: editedText });
    }
    setIsEditingText(false);
  };

  const cancelEditingText = () => {
    setEditedText("");
    setIsEditingText(false);
  };

  // Main view with tool cards
  // This view is now at the end of the component as the final return
  if (currentView === "main") {
    // Skip - handled by final return
  }

  // Image Generation View
  if (currentView === "image-generation") {
    return (
      <div className="min-h-screen">
        <PageBreadcrumbs />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Button 
              variant="ghost" 
              className="mb-4"
              onClick={() => {
                setCurrentView("main");
                resetImageGeneration();
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад до інструментів
            </Button>

          {!showImageResult ? (
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-6 h-6 text-primary" />
                  <CardTitle>Генерація зображень AI</CardTitle>
                </div>
                <CardDescription>
                  Генеруйте аватари, банери та промо зображення для вашого Telegram каналу
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Опис зображення</label>
                  <Textarea
                    placeholder="Наприклад: красивий банер для технологічного каналу з футуристичним дизайном"
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    rows={4}
                    disabled={isGenerating}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Вартість:</span>
                  <div className="flex items-center gap-2">
                    {isVip && toolsSettings['image_generation']?.vip_discount_enabled && (
                      <>
                        <span className="text-muted-foreground line-through text-xs">{toolsSettings['image_generation']?.price}₴</span>
                        <span className="text-yellow-500 font-semibold text-xs">VIP -{toolsSettings['image_generation']?.vip_discount_percent}%</span>
                      </>
                    )}
                    <span className="font-semibold">
                      <BonusBalanceDisplay amount={getVipPrice(toolsSettings['image_generation']?.price || 5, 'image_generation')} iconSize={16} />
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ваш баланс:</span>
                  <span className={`font-semibold ${profile?.bonus_balance < getVipPrice(toolsSettings['image_generation']?.price || 5, 'image_generation') ? "text-destructive" : ""}`}>
                    <BonusBalanceDisplay amount={profile?.bonus_balance || 0} iconSize={16} />
                  </span>
                </div>

                <Button
                  className="w-full"
                  onClick={handleGenerate}
                  disabled={isGenerating || !profile || profile.bonus_balance < getVipPrice(toolsSettings['image_generation']?.price || 5, 'image_generation')}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Генерується...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Генерувати
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                  <CardTitle>Ваш результат</CardTitle>
                </div>
                <CardDescription>Зображення успішно згенеровано</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedImage && (
                  <>
                    <div className="relative">
                      <img
                        src={generatedImage}
                        alt="Generated"
                        className="w-full rounded-lg border"
                      />
                      {timeRemaining > 0 && (
                        <div className="absolute top-2 right-2 bg-destructive/90 text-destructive-foreground px-3 py-1.5 rounded-full flex items-center gap-2 font-semibold text-sm backdrop-blur-sm">
                          <Clock className="w-4 h-4" />
                          {timeRemaining}с
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Встигніть завантажити!</span>
                        <span className="font-semibold text-destructive">{timeRemaining} секунд</span>
                      </div>
                      <Progress value={(timeRemaining / 20) * 100} className="h-2" />
                    </div>
                    
                    <div className="grid gap-2">
                      <Button
                        variant="default"
                        className="w-full"
                        onClick={downloadImage}
                      >
                        <Download className="w-4 h-4 mr-2" />
                        Завантажити зображення
                      </Button>
                      
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={resetImageGeneration}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Спробувати ще раз
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* Beautiful Loading Overlay */}
          {isGenerating && (
            <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
              <Card className="w-[90%] max-w-md border-2 shadow-2xl">
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center space-y-6">
                    <div className="relative">
                      <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                      <Sparkles className="w-12 h-12 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                    </div>
                    
                    <div className="text-center space-y-2">
                      <h3 className="text-xl font-semibold">Зображення генерується...</h3>
                      <p className="text-muted-foreground text-sm animate-pulse">
                        {generatingProgress || "AI створює унікальне зображення для вас"}
                      </p>
                    </div>
                    
                    <div className="w-full space-y-2">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>Крок {imageGenCurrentStep + 1} з {imageGenSteps.length}</span>
                        <span>{Math.round(((imageGenCurrentStep + 1) / imageGenSteps.length) * 100)}%</span>
                      </div>
                      <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all duration-500 ease-out"
                          style={{ width: `${((imageGenCurrentStep + 1) / imageGenSteps.length) * 100}%` }}
                        />
                      </div>
                    </div>

                    <div className="w-full space-y-2 max-h-48 overflow-y-auto">
                      {imageGenSteps.map((step, index) => (
                        <div 
                          key={index}
                          className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                            index <= imageGenCurrentStep ? 'opacity-100' : 'opacity-30'
                          }`}
                        >
                          <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                            index < imageGenCurrentStep ? 'bg-green-500' : 
                            index === imageGenCurrentStep ? 'bg-primary animate-pulse' : 
                            'bg-muted'
                          }`} />
                          <span className={
                            index === imageGenCurrentStep ? 'text-primary font-medium' : 
                            index < imageGenCurrentStep ? 'text-muted-foreground line-through' :
                            'text-muted-foreground'
                          }>
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
      </div>
    );
  }

  // Post Generation View
  if (currentView === "post-generation") {
    return (
      <div className="min-h-screen">
        <PageBreadcrumbs />
        <div className="container mx-auto px-4 py-8">
          <div className="max-w-4xl mx-auto">
            <Button 
              variant="ghost" 
              className="mb-4"
              onClick={() => {
                setCurrentView("main");
                resetPostGeneration();
              }}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Назад до інструментів
            </Button>

          {!showPostResult ? (
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <FileText className="w-6 h-6 text-primary" />
                  <CardTitle>Генерація публікацій AI</CardTitle>
                </div>
                <CardDescription>
                  Створюйте готові пости для Telegram каналу з текстом та зображеннями
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Тип вводу</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={postInputType === "category" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setPostInputType("category")}
                    >
                      Категорія
                    </Button>
                    <Button
                      type="button"
                      variant={postInputType === "custom" ? "default" : "outline"}
                      className="flex-1"
                      onClick={() => setPostInputType("custom")}
                    >
                      Власний промпт
                    </Button>
                  </div>
                </div>

                {postInputType === "category" ? (
                  <div className="space-y-2">
                    <Label>Категорія публікації</Label>
                    <CategorySelector
                      value={postTopic}
                      onValueChange={setPostTopic}
                      categories={postCategories}
                      placeholder="Виберіть категорію"
                      disabled={isGeneratingPost}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Власний промпт</Label>
                    <Textarea
                      placeholder="Наприклад: Напиши пост про переваги ранкової медитації для продуктивності"
                      value={customPrompt}
                      onChange={(e) => setCustomPrompt(e.target.value)}
                      rows={4}
                      disabled={isGeneratingPost}
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <Label htmlFor="with-image">Додати зображення</Label>
                  <Switch
                    id="with-image"
                    checked={withImage}
                    onCheckedChange={setWithImage}
                    disabled={isGeneratingPost}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label htmlFor="with-tags">Генерувати теги (хештеги)</Label>
                  <Switch
                    id="with-tags"
                    checked={withTags}
                    onCheckedChange={setWithTags}
                    disabled={isGeneratingPost}
                  />
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Вартість:</span>
                  <div className="flex items-center gap-2">
                    {isVip && toolsSettings['post_generation']?.vip_discount_enabled && (
                      <>
                        <span className="text-muted-foreground line-through text-xs">
                          {toolsSettings['post_generation']?.price || 5}₴
                        </span>
                        <span className="text-yellow-500 font-semibold text-xs">
                          VIP -{toolsSettings['post_generation']?.vip_discount_percent}%
                        </span>
                      </>
                    )}
                    <span className="font-semibold">
                      <BonusBalanceDisplay 
                        amount={getVipPrice(toolsSettings['post_generation']?.price || 5, 'post_generation')} 
                        iconSize={16} 
                      />
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Ваш баланс:</span>
                  <span className={`font-semibold ${
                    profile?.bonus_balance < getVipPrice(toolsSettings['post_generation']?.price || 5, 'post_generation')
                      ? "text-destructive" 
                      : ""
                  }`}>
                    <BonusBalanceDisplay amount={profile?.bonus_balance || 0} iconSize={16} />
                  </span>
                </div>

                <Button
                  className="w-full"
                  onClick={handleGeneratePost}
                  disabled={isGeneratingPost || !profile || profile.bonus_balance < getVipPrice(toolsSettings['post_generation']?.price || 5, 'post_generation')}
                >
                  {isGeneratingPost ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Генерується...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Генерувати пост
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-6 h-6 text-success" />
                  <CardTitle>Ваш результат</CardTitle>
                </div>
                <CardDescription>Пост успішно згенеровано</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {generatedPost && (
                  <>
                     <div className="space-y-3">
                      <div className="p-4 bg-muted rounded-lg">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <p className="text-sm font-medium">Текст посту:</p>
                          {!isEditingText ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={startEditingText}
                              className="h-7 w-7 p-0"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                          ) : (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={saveEditedText}
                                className="h-7 w-7 p-0 text-success"
                              >
                                <Check className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditingText}
                                className="h-7 w-7 p-0 text-destructive"
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          )}
                        </div>
                        {isEditingText ? (
                          <Textarea
                            value={editedText}
                            onChange={(e) => setEditedText(e.target.value)}
                            rows={6}
                            className="mt-2"
                          />
                        ) : (
                          <p className="whitespace-pre-wrap">{generatedPost.text}</p>
                        )}
                      </div>

                      {generatedPost.imageUrl && (
                        <div>
                          <p className="text-sm font-medium mb-2">Зображення:</p>
                          <img
                            src={generatedPost.imageUrl}
                            alt="Post"
                            className="w-full rounded-lg border"
                          />
                        </div>
                      )}
                    </div>

                    <div className="grid gap-2">
                      <Button
                        variant="default"
                        className="w-full"
                        onClick={copyPostText}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Копіювати текст
                      </Button>

                      {generatedPost.imageUrl && (
                        <Button
                          variant="default"
                          className="w-full"
                          onClick={downloadPostImage}
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Завантажити зображення
                        </Button>
                      )}

                      <Button
                        variant="default"
                        className="w-full"
                        onClick={openPublishDialog}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        Опублікувати в Telegram
                      </Button>

                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={resetPostGeneration}
                      >
                        <Sparkles className="w-4 h-4 mr-2" />
                        Спробувати ще раз
                      </Button>
                     </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Beautiful Loading Overlay for Post Generation */}
      {isGeneratingPost && (
        <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
          <Card className="w-[90%] max-w-md border-2 shadow-2xl">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center space-y-6">
                <div className="relative">
                  <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                  <FileText className="w-12 h-12 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                </div>
                
                <div className="text-center space-y-2">
                  <h3 className="text-xl font-semibold">Пост генерується...</h3>
                  <p className="text-muted-foreground text-sm animate-pulse">
                    {generatingPostProgress || "AI створює контент для вас"}
                  </p>
                </div>
                
                <div className="w-full space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                    <span>Крок {postGenCurrentStep + 1} з {postGenSteps.length}</span>
                    <span>{Math.round(((postGenCurrentStep + 1) / postGenSteps.length) * 100)}%</span>
                  </div>
                  <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-500 ease-out"
                      style={{ width: `${((postGenCurrentStep + 1) / postGenSteps.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="w-full space-y-2 max-h-48 overflow-y-auto">
                  {postGenSteps.map((step, index) => (
                    <div 
                      key={index}
                      className={`flex items-center gap-2 text-sm transition-all duration-300 ${
                        index <= postGenCurrentStep ? 'opacity-100' : 'opacity-30'
                      }`}
                    >
                      <div className={`h-2 w-2 rounded-full flex-shrink-0 ${
                        index < postGenCurrentStep ? 'bg-green-500' : 
                        index === postGenCurrentStep ? 'bg-primary animate-pulse' : 
                        'bg-muted'
                      }`} />
                      <span className={
                        index === postGenCurrentStep ? 'text-primary font-medium' : 
                        index < postGenCurrentStep ? 'text-muted-foreground line-through' :
                        'text-muted-foreground'
                      }>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Channel Selection Dialog for Post Generation */}
      <Dialog open={showChannelDialog} onOpenChange={setShowChannelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Виберіть канал для публікації</DialogTitle>
            <DialogDescription>
              Оберіть канал в який хочете опублікувати згенерований пост
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] pr-4">
            {userChannels.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>У вас немає доданих каналів</p>
                <Button
                  variant="link"
                  onClick={() => {
                    setShowChannelDialog(false);
                    navigate("/my-channels");
                  }}
                  className="mt-2"
                >
                  Додати канал
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {userChannels.map((channel) => {
                  const info = channelInfo[channel.id];
                  return (
                    <Button
                      key={channel.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-3"
                      onClick={() => publishToChannel(channel)}
                      disabled={isPublishing}
                    >
                      <div className="flex items-center gap-3 w-full">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {info?.photo ? (
                            <img src={info.photo} alt={info.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl font-bold text-primary">
                              {(info?.title || channel.target_channel).charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        
                        {/* Channel Info */}
                        <div className="flex flex-col items-start flex-1 min-w-0">
                          <span className="font-semibold text-sm truncate w-full">
                            {info?.title || channel.target_channel}
                          </span>
                          <span className="text-xs text-muted-foreground truncate w-full">
                            @{info?.username || channel.target_channel.replace('@', '')}
                          </span>
                        </div>

                        {/* Arrow Icon */}
                        <Send className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
      </div>
    );
  }

  // Main Tools View
  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <PageHeader
            icon={Sparkles}
            title="Інструменти AI"
            description="Генеруйте зображення та пости за допомогою штучного інтелекту"
          />

          {!aiToolEnabled && !aiPostToolEnabled ? (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-muted-foreground">
                  Інструменти тимчасово недоступні. Зверніться до адміністратора.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {/* Image Generation Tool Card */}
              {toolsSettings['image_generation']?.is_enabled !== false && (
              <Card 
                className="border-2 transition-all cursor-pointer hover:border-primary/50 hover:shadow-lg"
                onClick={() => setCurrentView("image-generation")}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="w-6 h-6 text-primary" />
                      <CardTitle className="text-lg">
                        {toolsSettings['image_generation']?.tool_name || 'Генерація зображень'}
                      </CardTitle>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <CardDescription className="text-sm">
                    {toolsSettings['image_generation']?.tool_description || 'Створюйте унікальні зображення для вашого Telegram каналу за допомогою AI'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Статус:</span>
                    <span className={`text-xs font-semibold ${aiToolEnabled ? 'text-success' : 'text-destructive'}`}>
                      {aiToolEnabled ? 'Доступно' : 'Не доступно'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Вартість:</span>
                    <div className="flex items-center gap-2">
                      {isVip && toolsSettings['image_generation']?.vip_discount_enabled && (
                        <>
                          <span className="text-xs text-muted-foreground line-through">{toolsSettings['image_generation']?.price}₴</span>
                          <span className="text-xs font-semibold text-yellow-500">VIP -{toolsSettings['image_generation']?.vip_discount_percent}%</span>
                        </>
                      )}
                      <span className="text-xs font-semibold">
                        <BonusBalanceDisplay amount={getVipPrice(toolsSettings['image_generation']?.price || 5, 'image_generation')} iconSize={14} />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Ваш баланс:</span>
                  <span className={`text-xs font-semibold ${
                    profile?.bonus_balance < getVipPrice(toolsSettings['image_generation']?.price || 5, 'image_generation') ? "text-destructive" : ""
                  }`}>
                    <BonusBalanceDisplay amount={profile?.bonus_balance || 0} iconSize={14} />
                  </span>
                  </div>
                </CardContent>
              </Card>
              )}

              {/* Post Generation Tool Card */}
              {toolsSettings['post_generation']?.is_enabled !== false && (
              <Card 
                className="border-2 transition-all cursor-pointer hover:border-primary/50 hover:shadow-lg"
                onClick={() => setCurrentView("post-generation")}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-6 h-6 text-primary" />
                      <CardTitle className="text-lg">
                        {toolsSettings['post_generation']?.tool_name || 'Генерація публікацій'}
                      </CardTitle>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <CardDescription className="text-sm">
                    {toolsSettings['post_generation']?.tool_description || 'Створюйте готові пости для Telegram з текстом та зображеннями'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Статус:</span>
                    <span className={`text-xs font-semibold ${aiPostToolEnabled ? 'text-success' : 'text-destructive'}`}>
                      {aiPostToolEnabled ? 'Доступно' : 'Не доступно'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Вартість:</span>
                    <div className="flex items-center gap-2">
                      {isVip && toolsSettings['post_generation']?.vip_discount_enabled && (
                        <>
                          <span className="text-xs text-muted-foreground line-through">{toolsSettings['post_generation']?.price}₴</span>
                          <span className="text-xs font-semibold text-yellow-500">VIP -{toolsSettings['post_generation']?.vip_discount_percent}%</span>
                        </>
                      )}
                      <span className="text-xs font-semibold">
                        <BonusBalanceDisplay amount={getVipPrice(toolsSettings['post_generation']?.price || 5, 'post_generation')} iconSize={14} />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Ваш баланс:</span>
                    <span className={`text-xs font-semibold ${
                      profile?.bonus_balance < getVipPrice(toolsSettings['post_generation']?.price || 5, 'post_generation') ? "text-destructive" : ""
                    }`}>
                      <BonusBalanceDisplay amount={profile?.bonus_balance || 0} iconSize={14} />
                    </span>
                  </div>
                </CardContent>
              </Card>
              )}

              {/* Neuro Promotion Tool Card */}
              <Card 
                className="border-2 transition-all cursor-pointer hover:border-primary/50 hover:shadow-lg"
                onClick={() => setShowNeuroPromotion(true)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-6 h-6 text-primary" />
                      <CardTitle className="text-lg">
                        НейроПросування
                      </CardTitle>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <CardDescription className="text-sm">
                    Нейропросування автоматично налаштує ваш канал для просування в Telegram та автопублікацій
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Статус:</span>
                    <span className="text-xs font-semibold text-success">Доступно</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Вартість:</span>
                    <span className="text-xs font-semibold text-green-500">Безкоштовно</span>
                  </div>
                </CardContent>
              </Card>

              {/* AI Chat Tool Card */}
              {toolsSettings['ai_chat']?.is_enabled && (
              <Card 
                className="border-2 transition-all cursor-pointer hover:border-primary/50 hover:shadow-lg"
                onClick={() => navigate("/ai-chat")}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <MessageSquare className="w-6 h-6 text-primary" />
                      <CardTitle className="text-lg">
                        {toolsSettings['ai_chat']?.tool_name || 'AI Чат'}
                      </CardTitle>
                    </div>
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  </div>
                  <CardDescription className="text-sm">
                    {toolsSettings['ai_chat']?.tool_description || 'Спілкуйтеся з AI асистентом, надсилайте зображення та отримуйте відповіді'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Статус:</span>
                    <span className="text-xs font-semibold text-success">Доступно</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Безкоштовно:</span>
                    <span className="text-xs font-semibold text-success">
                      {toolsSettings['ai_chat']?.free_duration_minutes || 10} хв / {toolsSettings['ai_chat']?.free_cooldown_hours || 6} год
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      Оренда ({toolsSettings['ai_chat']?.rental_duration_minutes || 60} хв):
                    </span>
                    <div className="flex items-center gap-2">
                      {isVip && toolsSettings['ai_chat']?.vip_discount_enabled && (
                        <>
                          <span className="text-xs text-muted-foreground line-through">{toolsSettings['ai_chat']?.price}₴</span>
                          <span className="text-xs font-semibold text-yellow-500">VIP -{toolsSettings['ai_chat']?.vip_discount_percent}%</span>
                        </>
                      )}
                      <span className="text-xs font-semibold">
                        <BonusBalanceDisplay amount={getVipPrice(toolsSettings['ai_chat']?.price || 10, 'ai_chat')} iconSize={14} />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Ваш баланс:</span>
                    <span className={`text-xs font-semibold ${
                      profile?.bonus_balance < getVipPrice(toolsSettings['ai_chat']?.price || 10, 'ai_chat') ? "text-destructive" : ""
                    }`}>
                      <BonusBalanceDisplay amount={profile?.bonus_balance || 0} iconSize={14} />
                    </span>
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Channel Selection Dialog */}
      <Dialog open={showChannelDialog} onOpenChange={setShowChannelDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Виберіть канал для публікації</DialogTitle>
            <DialogDescription>
              Оберіть канал в який хочете опублікувати згенерований пост
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[400px] pr-4">
            {userChannels.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <p>У вас немає доданих каналів</p>
                <Button
                  variant="link"
                  onClick={() => {
                    setShowChannelDialog(false);
                    navigate("/my-channels");
                  }}
                  className="mt-2"
                >
                  Додати канал
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {userChannels.map((channel) => {
                  const info = channelInfo[channel.id];
                  return (
                    <Button
                      key={channel.id}
                      variant="outline"
                      className="w-full justify-start text-left h-auto py-3 px-3"
                      onClick={() => publishToChannel(channel)}
                      disabled={isPublishing}
                    >
                      <div className="flex items-center gap-3 w-full">
                        {/* Avatar */}
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                          {info?.photo ? (
                            <img src={info.photo} alt={info.title} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xl font-bold text-primary">
                              {(info?.title || channel.target_channel).charAt(0).toUpperCase()}
                            </span>
                          )}
                        </div>
                        
                        {/* Channel Info */}
                        <div className="flex flex-col items-start flex-1 min-w-0">
                          <span className="font-semibold text-sm truncate w-full">
                            {info?.title || channel.target_channel}
                          </span>
                          <span className="text-xs text-muted-foreground truncate w-full">
                            @{info?.username || channel.target_channel.replace('@', '')}
                          </span>
                        </div>

                        {/* Arrow Icon */}
                        <Send className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                    </Button>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Neuro Promotion Dialog */}
      <NeuroPromotion open={showNeuroPromotion} onOpenChange={setShowNeuroPromotion} />
    </div>
  );
}