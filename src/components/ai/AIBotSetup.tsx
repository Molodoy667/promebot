// @ts-nocheck
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Save, Loader2, CheckCircle2, Info, HelpCircle, Bot, Play, Square, X, ChevronDown, ChevronUp, Pause, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { attachSpyToBotService } from "@/lib/spy-manager";
import addBotInstruction from "@/assets/add-bot-instruction.jpg";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { parseTelegramChannel, normalizeTelegramChannel } from "@/lib/telegram-channel-parser";
import { getCategoryIcon } from "@/lib/category-icons";

interface AIBotSetupProps {
  botId: string;
  botUsername: string;
  botToken: string;
  userId: string;
  serviceId?: string;
  onSaveSuccess?: () => void;
}

interface CategoryOption {
  value: string;
  label: string;
  emoji: string;
}

interface AIBotService {
  id: string;
  target_channel: string;
  service_type: 'category_generation';
  is_running: boolean;
}

interface PublishingSettings {
  publish_new_only?: boolean;
  time_from?: string;
  time_to?: string;
  post_interval_minutes?: number;
  include_media?: boolean;
  use_custom_prompt?: boolean;
  custom_prompt?: string;
  generate_tags?: boolean;
}

interface GeneratedPost {
  id: string;
  category: string;
  post_content?: string;
  content?: string;
  image_url?: string;
  status: string;
  created_at: string;
  published_at?: string;
}

interface ChannelInfo {
  title: string;
  username?: string;
  photo_url?: string;
  members_count?: number;
}

interface UserTariff {
  allow_ai_images?: boolean;
}

export const AIBotSetup = ({ botId, botUsername, botToken, userId, serviceId, onSaveSuccess }: AIBotSetupProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingBot, setIsCheckingBot] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState("");
  const [verificationSteps, setVerificationSteps] = useState<string[]>([]);
  const [verificationCurrentStep, setVerificationCurrentStep] = useState(0);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [postCategories, setPostCategories] = useState<CategoryOption[]>([]);
  
  const [targetChannel, setTargetChannel] = useState("");
  const [targetChannelType, setTargetChannelType] = useState<"public" | "private">("public");
  const [targetInviteLink, setTargetInviteLink] = useState("");
  const [channelVerified, setChannelVerified] = useState(false);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<{
    isMember: boolean | null;
    hasPermissions: boolean | null;
  }>({ isMember: null, hasPermissions: null });
  
  const [service, setService] = useState<AIBotService | null>(null);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedCategoryObjects, setSelectedCategoryObjects] = useState<CategoryOption[]>([]);
  
  const [enableTimeFilter, setEnableTimeFilter] = useState(false);
  const [timeFrom, setTimeFrom] = useState("09:00");
  const [timeTo, setTimeTo] = useState("22:00");
  
  const [enableTimerPublish, setEnableTimerPublish] = useState(true);
  const [postInterval, setPostInterval] = useState(60);
  
  const [includeMedia, setIncludeMedia] = useState(false);
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [generateTags, setGenerateTags] = useState(false);
  const [userTariff, setUserTariff] = useState<UserTariff | null>(null);
  
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [postsOpen, setPostsOpen] = useState(true);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [showStats, setShowStats] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  useEffect(() => {
    const initializeData = async () => {
      await loadUserTariff();
      await loadCategories();
      await loadAIBotService();
    };
    
    initializeData();
    
    // Real-time sync for categories
    const channel = supabase
      .channel('category_prompts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'category_prompts',
        },
        () => {
          console.log('Categories changed, reloading...');
          loadCategories();
        }
      )
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [botId, userId, serviceId]);

  const loadUserTariff = async () => {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select(`
          tariffs (
            allow_ai_images
          )
        `)
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error loading user tariff:', error);
        return;
      }

      if (data?.tariffs) {
        setUserTariff(data.tariffs as unknown as UserTariff);
        console.log('User tariff loaded:', data.tariffs);
      }
    } catch (error) {
      console.error('Error loading user tariff:', error);
    }
  };

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
          .filter(cat => cat.category_key) // Only categories with keys
          .map(cat => ({
            value: cat.category_key,
            label: cat.category_name,
            emoji: cat.emoji || '📝'
          }));
        
        setPostCategories(categories);
        console.log('Categories loaded:', categories.length);
        
        // Update category objects if categories are already selected
        if (selectedCategories.length > 0) {
          const categoryObjs = categories.filter(c => selectedCategories.includes(c.value));
          setSelectedCategoryObjects(categoryObjs);
          console.log('Updated category objects:', categoryObjs.length);
        }
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  useEffect(() => {
    if (service?.is_running) {
      loadGeneratedPosts();
      const interval = setInterval(loadGeneratedPosts, 10000); // Refresh every 10 seconds
      return () => clearInterval(interval);
    }
  }, [service?.is_running]);

  // Sync category objects when postCategories or selectedCategories change
  useEffect(() => {
    if (postCategories.length > 0 && selectedCategories.length > 0) {
      const categoryObjs = postCategories.filter(c => selectedCategories.includes(c.value));
      if (categoryObjs.length !== selectedCategoryObjects.length) {
        setSelectedCategoryObjects(categoryObjs);
        console.log('Synced category objects:', categoryObjs.length);
      }
    }
  }, [postCategories, selectedCategories]);

  // Track changes in settings - mark as changed when any setting is modified (only if previously saved)
  useEffect(() => {
    if (settingsSaved) {
      setHasUnsavedChanges(true);
    }
  }, [selectedCategories, postInterval, includeMedia, useCustomPrompt, customPrompt, enableTimeFilter, timeFrom, timeTo, enableTimerPublish, generateTags]);

  const loadAIBotService = async () => {
    // Якщо serviceId не передано, працюємо в режимі додавання НОВОГО каналу,
    // тому не завантажуємо останній сервіс автоматично
    if (!serviceId) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      
      const { data: services, error } = await supabase
        .from("ai_bot_services")
        .select("*")
        .eq("id", serviceId)
        .maybeSingle();

      if (error) throw error;

      if (services) {
        setService(services as AIBotService);
        setTargetChannel(services.target_channel);
        setChannelVerified(true);
        await loadChannelInfo(services.target_channel);
        await loadServiceSettings(services.id);
        if (services.is_running) {
          setSettingsOpen(false);
        }
        
        // Real-time sync for bot status
        const channel = supabase
          .channel(`ai_bot_service_${services.id}`)
          .on(
            'postgres_changes',
            {
              event: 'UPDATE',
              schema: 'public',
              table: 'ai_bot_services',
              filter: `id=eq.${services.id}`,
            },
            (payload) => {
              console.log('Service updated:', payload);
              setService(payload.new as AIBotService);
            }
          )
          .subscribe();
      }
    } catch (error: any) {
      console.error("Error loading AI service:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити налаштування AI бота",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  const loadChannelInfo = async (channel: string) => {
    try {
      let channelIdentifier = channel.trim();
      
      if (channelIdentifier.includes('t.me/')) {
        const match = channelIdentifier.match(/t\.me\/([^/?]+)/);
        if (match) {
          channelIdentifier = match[1];
        }
      }
      
      channelIdentifier = channelIdentifier.replace('@', '');
      const isChatId = /^-?\d+$/.test(channelIdentifier);
      
      if (isChatId) {
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=${channelIdentifier}`
        );
        const data = await response.json();
        
        if (data.ok) {
          let photoUrl: string | undefined = undefined;
          if (data.result.photo?.big_file_id) {
            const fileResponse = await fetch(
              `https://api.telegram.org/bot${botToken}/getFile?file_id=${data.result.photo.big_file_id}`
            );
            const fileData = await fileResponse.json();
            if (fileData.ok) {
              photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
            }
          }
          
          setChannelInfo({
            title: data.result.title || channelIdentifier,
            username: data.result.username,
            photo_url: photoUrl,
            members_count: data.result.members_count,
          });
        }
      } else {
        const response = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${channelIdentifier}`
        );
        const data = await response.json();
        
        if (data.ok) {
          let photoUrl: string | undefined = undefined;
          if (data.result.photo?.big_file_id) {
            const fileResponse = await fetch(
              `https://api.telegram.org/bot${botToken}/getFile?file_id=${data.result.photo.big_file_id}`
            );
            const fileData = await fileResponse.json();
            if (fileData.ok) {
              photoUrl = `https://api.telegram.org/file/bot${botToken}/${fileData.result.file_path}`;
            }
          }
          
          setChannelInfo({
            title: data.result.title || `@${channelIdentifier}`,
            username: data.result.username,
            photo_url: photoUrl,
            members_count: data.result.members_count,
          });
        }
      }
    } catch (error) {
      console.error("Error loading channel info:", error);
    }
  };

  const loadServiceSettings = async (serviceId: string) => {
    try {
      console.log('Loading settings for service:', serviceId);
      
      const { data: settings, error } = await supabase
        .from("ai_publishing_settings")
        .select("*")
        .eq("ai_bot_service_id", serviceId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      console.log('Settings query result:', { settings, error });

      if (settings) {
        setEnableTimeFilter(!!settings.time_from && !!settings.time_to);
        setTimeFrom(settings.time_from || "09:00");
        setTimeTo(settings.time_to || "22:00");
        setEnableTimerPublish(settings.post_interval_minutes !== null && settings.post_interval_minutes !== undefined);
        setPostInterval(settings.post_interval_minutes || 60);
        setIncludeMedia(settings.include_media ?? true);
        setUseCustomPrompt(settings.use_custom_prompt ?? false);
        setCustomPrompt(settings.custom_prompt || "");
        setGenerateTags(settings.generate_tags ?? false);
        setSettingsSaved(true);
      }

      // Load categories from content sources
      const { data: sources, error: sourcesError } = await supabase
        .from("ai_content_sources")
        .select("category")
        .eq("ai_bot_service_id", serviceId)
        .eq("source_type", "category");

      if (sourcesError) throw sourcesError;

      const categories = sources?.map(s => s.category).filter(Boolean) as string[] || [];
      setSelectedCategories(categories);
      
      console.log('Loaded settings:', {
        categories,
        categoryObjs: 0, // Will be set later when postCategories loads
        settings,
        postCategoriesLength: postCategories.length
      });
      
      // Store original values after loading
      setOriginalSettings({
        categories: categories,
        useCustomPrompt: settings?.use_custom_prompt ?? false,
        customPrompt: settings?.custom_prompt || "",
        enableTimeFilter: !!settings?.time_from && !!settings?.time_to,
        timeFrom: settings?.time_from || "09:00",
        timeTo: settings?.time_to || "22:00",
        postInterval: settings?.post_interval_minutes || 60,
        includeMedia: settings?.include_media ?? true,
        generateTags: settings?.generate_tags ?? false,
      });
    } catch (error: any) {
      console.error("Error loading settings:", error);
    }
  };

  // Store original values to detect changes
  const [originalSettings, setOriginalSettings] = useState<{
    categories: string[];
    useCustomPrompt: boolean;
    customPrompt: string;
    enableTimeFilter: boolean;
    timeFrom: string;
    timeTo: string;
    postInterval: number;
    includeMedia: boolean;
    generateTags: boolean;
  }>({ 
    categories: [], 
    useCustomPrompt: false, 
    customPrompt: "",
    enableTimeFilter: false,
    timeFrom: "09:00",
    timeTo: "22:00",
    postInterval: 60,
    includeMedia: true,
    generateTags: false,
  });

  // Calculate next publish time for a scheduled post
  const calculateNextPublishTime = (
    allPosts: GeneratedPost[],
    scheduledPost: GeneratedPost,
    settings: {
      post_interval_minutes: number;
      time_from: string;
      time_to: string;
    } | null
  ): string | null => {
    if (!settings) return null;

    // Sort all posts by creation time
    const sortedPosts = [...allPosts].sort((a, b) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );

    // Find the index of current post
    const postIndex = sortedPosts.findIndex(p => p.id === scheduledPost.id);
    if (postIndex === -1) return null;

    // Calculate base time for first post
    let baseTime = new Date();
    
    // Find the earliest post's creation time as base
    const firstPostCreationTime = new Date(sortedPosts[0].created_at);
    
    // Check if we have any published posts
    const publishedPosts = sortedPosts.filter(p => p.status === 'published' && p.published_at);
    
    if (publishedPosts.length > 0) {
      // If we have published posts, base on the last one
      const lastPublished = publishedPosts[publishedPosts.length - 1];
      baseTime = new Date(lastPublished.published_at!);
      
      // Calculate how many posts are scheduled after the last published one
      const publishedIndex = sortedPosts.findIndex(p => p.id === lastPublished.id);
      const postsAfterPublished = postIndex - publishedIndex;
      
      // Add intervals for each post between last published and current
      baseTime = new Date(baseTime.getTime() + (postsAfterPublished * settings.post_interval_minutes * 60 * 1000));
    } else {
      // No published posts yet - first post publishes immediately, others at intervals
      if (postIndex === 0) {
        // First post publishes immediately
        baseTime = new Date();
      } else {
        // Subsequent posts: base time + (index * interval)
        baseTime = new Date(firstPostCreationTime.getTime() + (postIndex * settings.post_interval_minutes * 60 * 1000));
      }
    }

    // Make sure we're not in the past
    const now = new Date();
    if (baseTime < now) {
      baseTime = now;
    }

    // Check time constraints
    if (settings.time_from && settings.time_to) {
      const [fromHour, fromMinute] = settings.time_from.split(':').map(Number);
      const [toHour, toMinute] = settings.time_to.split(':').map(Number);

      const currentHour = baseTime.getHours();
      const currentMinute = baseTime.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;
      const fromTimeInMinutes = fromHour * 60 + fromMinute;
      const toTimeInMinutes = toHour * 60 + toMinute;

      // If outside allowed time, move to next allowed window
      if (currentTimeInMinutes < fromTimeInMinutes) {
        baseTime.setHours(fromHour, fromMinute, 0, 0);
      } else if (currentTimeInMinutes > toTimeInMinutes) {
        // Move to next day at start time
        baseTime.setDate(baseTime.getDate() + 1);
        baseTime.setHours(fromHour, fromMinute, 0, 0);
      }
    }

    return baseTime.toISOString();
  };

  const loadGeneratedPosts = async () => {
    if (!service?.id) return;

    try {
      const { data, error } = await supabase
        .from("ai_generated_posts")
        .select("*")
        .eq("ai_bot_service_id", service.id)
        .eq("status", "scheduled")
        .order("created_at", { ascending: true })
        .limit(10);

      if (error) throw error;

      setGeneratedPosts((data || []) as GeneratedPost[]);
    } catch (error) {
      console.error("Error loading generated posts:", error);
    }
  };

  const handleVerifyChannel = async () => {
    if (!targetChannel) {
      toast({
        title: "Помилка",
        description: "Вкажіть цільовий канал",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingBot(true);
    setVerificationStatus({ isMember: null, hasPermissions: null });
    
    const steps = [
      "Перевірка існування каналу",
      "Визначення типу каналу",
      "Підключення до Telegram API",
      "Перевірка доступу бота",
      "Перевірка прав адміністратора",
      "Синхронізація налаштувань",
      "Завершення підключення"
    ];
    setVerificationSteps(steps);
    setVerificationCurrentStep(0);
    setVerificationProgress(steps[0]);
    setVerificationError(null);

    try {
      let channelIdentifier = targetChannel.trim();
      
      // Автоматично визначаємо приватний канал за invite-посиланням
      if (channelIdentifier.includes('t.me/+') || channelIdentifier.includes('t.me/joinchat/')) {
        // Крок 1: Перевірка існування
        setVerificationCurrentStep(1);
        setVerificationProgress(steps[0]);
        await new Promise(resolve => setTimeout(resolve, 800));

        // Отримуємо активного spy
        const { data: activeSpy } = await supabase
          .from('telegram_spies')
          .select('id')
          .eq('is_active', true)
          .eq('is_authorized', true)
          .limit(1)
          .maybeSingle();

        if (!activeSpy) {
          setVerificationError("Немає активного userbot для приватних каналів");
          setIsCheckingBot(false);
          setVerificationSteps([]);
          setVerificationCurrentStep(0);
          return;
        }
        
        // Крок 2: Визначення типу каналу
        setVerificationCurrentStep(2);
        setVerificationProgress(steps[1]);
        await new Promise(resolve => setTimeout(resolve, 800));

        // Крок 3: Підключення до Telegram API
        setVerificationCurrentStep(3);
        setVerificationProgress(steps[2]);
        await new Promise(resolve => setTimeout(resolve, 800));

        console.log('Checking private channel:', channelIdentifier);

        // Спочатку намагаємося приєднатись до каналу
        console.log('Attempting to join channel with userbot...');
        const { data: joinData, error: joinError } = await supabase.functions.invoke('spy-join-channel', {
          body: {
            spy_id: activeSpy.id,
            channel_identifier: channelIdentifier
          }
        });

        console.log('spy-join-channel response:', { joinData, joinError });

        // Перевірка чи join був успішний
        if (joinError || !joinData?.success) {
          console.error('spy-join-channel failed:', { joinError, joinData });
          setVerificationError(joinData?.error || joinError?.message || "Не вдалося приєднатись до каналу. Перевірте правильність invite посилання");
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }

        // Якщо приєдналися успішно і отримали channel_id - використовуємо його
        let channelToCheck = channelIdentifier;
        if (joinData?.channelInfo?.id) {
          channelToCheck = joinData.channelInfo.id;
          console.log('Using channel_id from join result:', channelToCheck);

          // Зберегти в pending_spy_channels для автовиходу через 5 хв
          if (!joinData.already_joined) {
            try {
              const { error: pendingError } = await supabase
                .from('pending_spy_channels')
                .insert({
                  spy_id: activeSpy.id,
                  channel_id: joinData.channelInfo.id,
                  channel_identifier: channelIdentifier,
                  user_id: (await supabase.auth.getUser()).data.user?.id
                });
              
              if (pendingError) {
                console.error('Failed to save pending channel:', pendingError);
              } else {
                console.log('Saved pending channel - will auto-leave in 5 minutes if not confirmed');
              }
            } catch (err) {
              console.error('Error saving pending channel:', err);
            }
          }
        }

        // Викликаємо spy-get-channel-info
        const { data: spyData, error: spyError } = await supabase.functions.invoke('spy-get-channel-info', {
          body: {
            spy_id: activeSpy.id,
            channel_identifier: channelToCheck
          }
        });

        console.log('spy-get-channel-info response:', { spyData, spyError });

        if (spyError) {
          console.error('spy-get-channel-info error:', spyError);
          setVerificationError(`Помилка підключення: ${spyError.message || "Не вдалося підключитись до приватного каналу"}`);
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }

        if (!spyData?.success) {
          console.log('spy-get-channel-info failed:', spyData);
          
          // Перевіряємо чи це проблема з доступом
          if (spyData?.error?.includes('Cannot find any entity') || spyData?.error?.includes('не знайдено')) {
            setVerificationError("Канал не знайдено або userbot не може приєднатися. Переконайтеся що invite посилання дійсне і не прострочене");
          } else {
            setVerificationError(spyData?.error || spyData?.message || "Не вдалося підключитись до приватного каналу");
          }
          
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }

        // Крок 4: Перевірка доступу бота
        setVerificationCurrentStep(4);
        setVerificationProgress(steps[3]);
        await new Promise(resolve => setTimeout(resolve, 800));

        // Перевіряємо чи userbot має доступ до каналу
        if (!spyData.channelInfo || !spyData.channelInfo.id) {
          setVerificationError("Не вдалося отримати інформацію про канал. Можливо userbot не має доступу");
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }

        // Перевіряємо тип каналу - має бути channel
        if (spyData.channelInfo.type && spyData.channelInfo.type !== 'channel') {
          const typeMap: Record<string, string> = {
            'group': 'група',
            'supergroup': 'супергрупа',
            'private': 'приватний чат'
          };
          const typeName = typeMap[spyData.channelInfo.type] || spyData.channelInfo.type;
          
          setVerificationError(`Це ${typeName}, а не канал. Вкажіть посилання на канал`);
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }
        
        // Крок 5: Перевірка прав адміністратора
        setVerificationCurrentStep(5);
        setVerificationProgress(steps[4]);
        await new Promise(resolve => setTimeout(resolve, 800));

        // Перевіряємо чи бот доданий до каналу як адміністратор
        const chatId = spyData.channelInfo.id;
        const botIdNum = botToken.split(':')[0];
        
        try {
          const memberResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${chatId}&user_id=${botIdNum}`
          );
          const memberData = await memberResponse.json();

          if (!memberData.ok) {
            setVerificationError("Бот не доданий до приватного каналу. Додайте бота як адміністратора");
            setTimeout(() => {
              setIsCheckingBot(false);
              setVerificationSteps([]);
              setVerificationCurrentStep(0);
            }, 5000);
            return;
          }

          if (memberData.result.status !== 'administrator' && memberData.result.status !== 'creator') {
            setVerificationError("Бот не має прав адміністратора в приватному каналі. Надайте боту права");
            setTimeout(() => {
              setIsCheckingBot(false);
              setVerificationSteps([]);
              setVerificationCurrentStep(0);
            }, 5000);
            return;
          }
        } catch (err) {
          console.error("Error checking bot admin status:", err);
          setVerificationError("Не вдалося перевірити права бота. Переконайтеся що бот доданий як адміністратор");
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }

        // Крок 6: Синхронізація налаштувань
        setVerificationCurrentStep(6);
        setVerificationProgress(steps[5]);
        await new Promise(resolve => setTimeout(resolve, 600));

        // Крок 7: Завершення підключення
        setVerificationCurrentStep(7);
        setVerificationProgress(steps[6]);
        await new Promise(resolve => setTimeout(resolve, 400));

        // Зберігаємо chat_id з spy
        setTargetChannel(chatId.toString());

        setVerificationStatus({ isMember: true, hasPermissions: true });
        setChannelVerified(true);
        
        toast({
          title: "Успішно!",
          description: `Приватний канал "${spyData.channelInfo.title}" підключено через userbot`,
          duration: 3000,
        });
        
        setIsCheckingBot(false);
        setVerificationSteps([]);
        setVerificationCurrentStep(0);
        return;
      }

      // If it's a regular t.me link, extract username
      if (channelIdentifier.includes('t.me/')) {
        const match = channelIdentifier.match(/t\.me\/([^/?]+)/);
        if (match) {
          channelIdentifier = match[1];
        }
      }
      
      // Remove @ prefix if present
      channelIdentifier = channelIdentifier.replace('@', '');
      
      // CHECK IF CHANNEL IS ALREADY TAKEN - BEFORE any bot verification
      const { data: ownerCheck, error: ownerError } = await supabase
        .rpc('check_channel_ownership', { 
          channel_identifier: channelIdentifier,
          current_user_id: userId 
        });
      
      if (ownerError) {
        console.error('Error checking ownership:', ownerError);
      }
      
      if (ownerCheck?.is_taken) {
        toast({
          title: "Канал вже зайнятий",
          description: "Цей канал вже використовується іншим користувачем",
          variant: "destructive",
          duration: 8000,
        });
        setIsCheckingBot(false);
        setVerificationSteps([]);
        setVerificationCurrentStep(0);
        return;
      }
      
      setVerificationCurrentStep(1);
      setVerificationProgress(steps[1]);
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Check if it looks like a chat_id (numeric, possibly negative)
      const isChatId = /^-?\d+$/.test(channelIdentifier);
      
      if (isChatId) {
        setVerificationCurrentStep(2);
        setVerificationProgress(steps[2]);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const checkResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=${channelIdentifier}`
        );
        const checkData = await checkResponse.json();

        if (!checkData.ok) {
          setVerificationError(`Не вдалося підключитись до каналу: ${checkData.description || "Перевірте chat_id та права бота"}`);
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }

        // Перевіряємо тип каналу
        if (checkData.result.type !== 'channel') {
          const typeMap: Record<string, string> = {
            'group': 'група',
            'supergroup': 'супергрупа',
            'private': 'приватний чат'
          };
          const typeName = typeMap[checkData.result.type] || checkData.result.type;
          
          setVerificationError(`Це ${typeName}, а не канал. Вкажіть посилання на канал`);
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }

        setVerificationStatus({ isMember: true, hasPermissions: null });
        setVerificationCurrentStep(3);
        setVerificationProgress(steps[3]);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const botIdNum = botToken.split(':')[0];
        const memberResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${channelIdentifier}&user_id=${botIdNum}`
        );
        const memberData = await memberResponse.json();

        if (!memberData.ok) {
          setVerificationError("Бот не доданий до каналу. Додайте бота як адміністратора");
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }

        if (memberData.result.status !== 'administrator' && memberData.result.status !== 'creator') {
          setVerificationStatus({ isMember: true, hasPermissions: false });
          setVerificationError("Бот не має прав адміністратора. Надайте боту права адміністратора");
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }

        setVerificationStatus({ isMember: true, hasPermissions: true });
        setVerificationCurrentStep(4);
        setVerificationProgress(steps[4]);
        await new Promise(resolve => setTimeout(resolve, 600));

        setChannelVerified(true);
        const channelTitle = checkData.result.title || channelIdentifier;
        toast({
          title: "Успішно!",
          description: `Бот підключений до приватного каналу "${channelTitle}"`,
          duration: 3000,
        });
        setIsCheckingBot(false);
        setVerificationSteps([]);
        setVerificationCurrentStep(0);
      } else {
        // Handle as public channel with username
        // Крок 1: Перевірка існування
        setVerificationCurrentStep(1);
        setVerificationProgress(steps[0]);
        await new Promise(resolve => setTimeout(resolve, 800));
        
        console.log('Checking public channel:', channelIdentifier);
        
        const getChatResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=@${channelIdentifier}`
        );
        const getChatData = await getChatResponse.json();
        
        console.log('getChat response:', getChatData);
        
        if (!getChatResponse.ok || !getChatData.ok) {
          console.log('Channel not found or error:', getChatData.description);
          setVerificationError(`Канал не знайдено: ${getChatData.description || "Перевірте правильність username або посилання"}`);
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }
        
        // Крок 2: Визначення типу
        setVerificationCurrentStep(2);
        setVerificationProgress(steps[1]);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (getChatData.result.type !== 'channel') {
          const typeMap: Record<string, string> = {
            'group': 'група',
            'supergroup': 'супергрупа',
            'private': 'приватний чат'
          };
          const typeName = typeMap[getChatData.result.type] || getChatData.result.type;
          
          setVerificationError(`Це ${typeName}, а не канал. Вкажіть посилання на канал`);
          setTimeout(() => {
            setIsCheckingBot(false);
            setVerificationSteps([]);
            setVerificationCurrentStep(0);
          }, 5000);
          return;
        }
        
        // Крок 3: Підключення до API
        setVerificationCurrentStep(3);
        setVerificationProgress(steps[2]);
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const { data, error } = await supabase.functions.invoke('check-bot-admin', {
          body: {
            botToken: botToken,
            channelUsername: channelIdentifier,
          },
        });

        if (error) throw error;

        setVerificationStatus({
          isMember: data.isMember,
          hasPermissions: data.isAdmin,
        });

        if (data.isAdmin && data.isMember) {
          setVerificationCurrentStep(4);
          setVerificationProgress(steps[4]);
          await new Promise(resolve => setTimeout(resolve, 600));
          
          setChannelVerified(true);
          toast({
            title: "Успішно!",
            description: "Бот підключений до каналу і має всі необхідні права",
            duration: 2000,
          });
        } else {
          // Крок 4: Перевірка доступу
          if (!data.isMember) {
            setVerificationError("Бот не доданий до каналу. Додайте бота як адміністратора");
            setTimeout(() => {
              setIsCheckingBot(false);
              setVerificationSteps([]);
              setVerificationCurrentStep(0);
            }, 5000);
            return;
          }
          
          // Крок 5: Перевірка прав
          if (!data.isAdmin) {
            setVerificationCurrentStep(5);
            setVerificationProgress(steps[4]);
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setVerificationError("Бот не має прав адміністратора. Надайте боту права");
            setTimeout(() => {
              setIsCheckingBot(false);
              setVerificationSteps([]);
              setVerificationCurrentStep(0);
            }, 5000);
            return;
          }
        }
      }
    } catch (error: any) {
      console.error("Error verifying bot:", error);
      setVerificationStatus({ isMember: false, hasPermissions: false });
      setVerificationError(error.message || "Не вдалося перевірити права бота. Перевірте підключення до інтернету");
      setTimeout(() => {
        setIsCheckingBot(false);
        setVerificationSteps([]);
        setVerificationCurrentStep(0);
      }, 5000);
    }
  };

  const handleSaveSettings = async () => {
    if (!useCustomPrompt && selectedCategories.length === 0) {
      toast({
        title: "Помилка",
        description: "Оберіть хоча б одну категорію або увімкніть власний промт",
        variant: "destructive",
      });
      return;
    }

    if (useCustomPrompt && !customPrompt.trim()) {
      toast({
        title: "Помилка",
        description: "Введіть власний промт",
        variant: "destructive",
      });
      return;
    }

    // Check if ANY settings changed
    const categoriesChanged = JSON.stringify(selectedCategories.sort()) !== JSON.stringify(originalSettings.categories.sort());
    const promptModeChanged = useCustomPrompt !== originalSettings.useCustomPrompt;
    const promptTextChanged = useCustomPrompt && customPrompt !== originalSettings.customPrompt;
    const timeFilterChanged = enableTimeFilter !== originalSettings.enableTimeFilter;
    const timeFromChanged = timeFrom !== originalSettings.timeFrom;
    const timeToChanged = timeTo !== originalSettings.timeTo;
    const intervalChanged = postInterval !== originalSettings.postInterval;
    const mediaChanged = includeMedia !== originalSettings.includeMedia;
    const tagsChanged = generateTags !== originalSettings.generateTags;

    const anySettingsChanged = categoriesChanged || promptModeChanged || promptTextChanged || 
                               timeFilterChanged || timeFromChanged || timeToChanged || 
                               intervalChanged || mediaChanged || tagsChanged;

    try {
      setIsSaving(true);

      // Stop service if running and ANY settings changed
      if (anySettingsChanged && service?.is_running) {
        await supabase
          .from("ai_bot_services")
          .update({ is_running: false })
          .eq("id", service.id);

        setService({ ...service, is_running: false });

        // Check notification settings before creating notification
        const { data: settings } = await supabase
          .from('notification_settings')
          .select('bot_status_enabled')
          .eq('user_id', userId)
          .maybeSingle();

        const isEnabled = settings?.bot_status_enabled ?? true;

        if (isEnabled) {
          // Create notification about bot stop
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'bot_stopped',
            title: 'AI бот зупинено',
            message: `AI бот для каналу "${targetChannel}" був автоматично зупинений через зміну налаштувань`,
            link: '/my-channels'
          });
        }
      }

      // Clear scheduled posts when ANY settings changed
      if (anySettingsChanged && service?.id) {
        await supabase
          .from("ai_generated_posts")
          .delete()
          .eq("ai_bot_service_id", service.id)
          .eq("status", "scheduled");
        
        setGeneratedPosts([]);
      }

      let serviceId = service?.id;

      // Create service if it doesn't exist OR if target channel changed
      if (!serviceId || (service && service.target_channel !== targetChannel)) {
        // Normalize channel before checks & save
        const normalizedChannel = normalizeTelegramChannel(targetChannel);

        // Check if this bot already has this channel attached
        const { data: existingService, error: existingError } = await supabase
          .from("ai_bot_services")
          .select("id, target_channel, bot_id")
          .eq("user_id", userId)
          .eq("bot_id", botId)
          .eq("service_type", "category_generation")
          .eq("target_channel", normalizedChannel)
          .maybeSingle();

        if (existingError && existingError.code !== "PGRST116") {
          console.error("Error checking existing AI service:", existingError);
        }

        if (existingService && existingService.id !== service?.id) {
          toast({
            title: "Канал вже додано",
            description: "Цей канал вже підключений до цього AI бота. Оберіть інший канал.",
            variant: "destructive",
          });
          setIsSaving(false);
          return;
        }

        // If service exists but channel changed, stop old service
        if (service?.id && service.target_channel !== normalizedChannel) {
          await supabase
            .from("ai_bot_services")
            .update({ is_running: false })
            .eq("id", service.id);
        }

        // Підключаємо юзербота для збору статистики
        const spyId = await attachSpyToBotService(normalizedChannel);

        // Create new service for new channel with spy attached
        const { data: newService, error: serviceError } = await supabase
          .from("ai_bot_services")
          .insert({
            user_id: userId,
            bot_id: botId,
            target_channel: normalizedChannel,
            service_type: "category_generation",
            spy_id: spyId,
          })
          .select()
          .single();

        if (serviceError) throw serviceError;
        serviceId = newService.id;
        setService(newService as AIBotService);
        
        // Підтвердити pending канал - змінити статус на "confirmed" щоб не видаляти
        if (normalizedChannel) {
          try {
            const { error: confirmError } = await supabase
              .from('pending_spy_channels')
              .update({ status: 'confirmed' })
              .eq('channel_id', normalizedChannel)
              .eq('status', 'pending');
            
            if (confirmError) {
              console.error('Failed to confirm pending channel:', confirmError);
            } else {
              console.log('Confirmed pending channel - will not auto-leave');
            }
          } catch (err) {
            console.error('Error confirming pending channel:', err);
          }
        }
      }
      // Save publishing settings
      const { error: settingsError } = await supabase
        .from("ai_publishing_settings")
        .upsert({
          ai_bot_service_id: serviceId,
          time_from: enableTimeFilter ? timeFrom : null,
          time_to: enableTimeFilter ? timeTo : null,
          post_interval_minutes: enableTimerPublish ? postInterval : null,
          include_media: includeMedia,
          use_custom_prompt: useCustomPrompt,
          custom_prompt: useCustomPrompt ? customPrompt : null,
          generate_tags: generateTags,
        }, {
          onConflict: 'ai_bot_service_id'
        });

      if (settingsError) throw settingsError;

      // Delete old categories
      const { error: deleteError } = await supabase
        .from("ai_content_sources")
        .delete()
        .eq("ai_bot_service_id", serviceId)
        .eq("source_type", "category");

      if (deleteError) throw deleteError;

      // Insert new categories only if not using custom prompt
      if (!useCustomPrompt && selectedCategories.length > 0) {
        const categoriesToInsert = selectedCategories.map(cat => ({
          ai_bot_service_id: serviceId,
          source_type: "category",
          category: cat,
        }));

        const { error: insertError } = await supabase
          .from("ai_content_sources")
          .insert(categoriesToInsert);

        if (insertError) throw insertError;
      }

      console.log('Settings saved successfully:', {
        serviceId,
        categories: selectedCategories,
        useCustomPrompt,
        enableTimeFilter,
        postInterval
      });
      
      setSettingsSaved(true);
      setHasUnsavedChanges(false);
      setSettingsOpen(false);
      
      // Update original settings after successful save
      setOriginalSettings({
        categories: selectedCategories,
        useCustomPrompt: useCustomPrompt,
        customPrompt: customPrompt,
        enableTimeFilter: enableTimeFilter,
        timeFrom: timeFrom,
        timeTo: timeTo,
        postInterval: postInterval,
        includeMedia: includeMedia,
        generateTags: generateTags,
      });

      // Show message about bot stop if it was running
      if (anySettingsChanged && service?.is_running) {
        toast({
          title: "Успішно",
          description: "Налаштування збережено. Бот зупинено та згенеровані пости очищено. Запустіть бота знову в розділі 'Мої канали'.",
          duration: 5000,
        });
      } else {
        toast({
          title: "Успішно",
          description: "Налаштування збережено",
        });
      }

      // Call onSaveSuccess callback if provided
      if (onSaveSuccess) {
        setTimeout(() => onSaveSuccess(), 1000);
      }
    } catch (error: any) {
      console.error("Error saving settings:", error);
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleService = async () => {
    console.log('🚀 AI handleToggleService called!');
    console.log('AI Service:', service);
    
    if (!service?.id) {
      console.log('❌ No AI service');
      return;
    }

    // Check if there are unsaved changes
    if (hasUnsavedChanges) {
      console.log('⚠️ Has unsaved changes');

      toast({
        title: "Незбережені зміни",
        description: "Спочатку збережіть налаштування",
        variant: "destructive",
      });
      return;
    }

    try {
      const newRunningState = !service.is_running;
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from("ai_bot_services")
        .update({ 
          is_running: newRunningState,
          started_at: newRunningState ? now : service.started_at
        })
        .eq("id", service.id);

      if (error) throw error;

      // Сповіщення створюється через MyChannels.tsx при запуску/зупинці бота

      setService({ ...service, is_running: newRunningState, started_at: newRunningState ? now : service.started_at });
      
      if (newRunningState) {
        await loadGeneratedPosts();
      } else {
        // On stop: clear generated posts from view only (keep in DB as scheduled)
        setGeneratedPosts([]);
        setExpandedPostId(null);
      }

      toast({
        title: newRunningState ? "Запущено" : "Зупинено",
        description: newRunningState ? "AI бот почав генерацію публікацій" : "AI бот зупинено",
      });
    } catch (error: any) {
      console.error("Error toggling service:", error);
      
      // Створюємо сповіщення про помилку
      const { data: { user } } = await supabase.auth.getUser();
      if (user && service) {
        await supabase.rpc('create_bot_error_notification', {
          p_user_id: user.id,
          p_bot_name: service.name || 'AI Бот',
          p_channel_name: service.channel_name,
          p_error_message: error.message || 'Невідома помилка',
          p_service_type: 'ai'
        });
      }
      
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="relative w-12 h-12">
            <div className="absolute inset-0 rounded-full border-2 border-primary/30"></div>
            <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary animate-spin"></div>
          </div>
          <p className="text-sm text-muted-foreground animate-pulse">Завантаження...</p>
        </div>
      </div>
    );
  }

  if (!channelVerified) {
    return (
      <>
        {isCheckingBot && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
            <Card className="w-[90%] max-w-md border-2 shadow-2xl">
              <div className="p-6">
                <div className="flex flex-col items-center space-y-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Sparkles className="w-12 h-12 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  
                  <div className="text-center space-y-2">
                    {verificationError ? (
                      <>
                        <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                          <XCircle className="w-8 h-8 text-destructive" />
                        </div>
                        <h3 className="text-xl font-semibold text-destructive">Помилка перевірки</h3>
                        <p className="text-muted-foreground text-sm mt-2">
                          {verificationError}
                        </p>
                        <p className="text-muted-foreground text-xs mt-2 opacity-70">
                          Автозакриття через 5 сек...
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-xl font-semibold">Перевірка AI бота...</h3>
                        <p className="text-muted-foreground text-sm">
                          {verificationProgress || "Перевіряємо підключення до каналу"}
                        </p>
                        <p className="text-muted-foreground text-xs mt-1">
                          {Math.round((verificationCurrentStep / verificationSteps.length) * 100)}% завершено
                        </p>
                      </>
                    )}
                  </div>
                  
                  {verificationSteps.length > 0 && (
                    <div className="w-full space-y-2">
                      {verificationSteps.map((step, index) => (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          {index < verificationCurrentStep ? (
                            <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          ) : index === verificationCurrentStep ? (
                            <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                          ) : (
                            <div className="w-5 h-5 rounded-full border-2 border-muted flex-shrink-0" />
                          )}
                          <span className={index <= verificationCurrentStep ? "text-foreground" : "text-muted-foreground"}>
                            {step}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="w-full space-y-2">
                    <div className="h-2 bg-primary/20 rounded-full overflow-hidden relative">
                      <div 
                        className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full transition-all duration-500"
                        style={{ width: `${((verificationCurrentStep + 1) / verificationSteps.length) * 100}%` }}
                      />
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Крок {verificationCurrentStep + 1} з {verificationSteps.length}
                    </p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
        <Card className="p-8">
          <div className="space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-gradient-primary mx-auto mb-4 flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Підключення AI бота</h2>
            <p className="text-muted-foreground">
              Додайте AI бота до свого каналу та надайте йому права адміністратора
            </p>
          </div>

          <Alert>
            <AlertDescription>
              <ol className="list-decimal list-inside space-y-3">
                <li>
                  Додайте AI бота{" "}
                  <a 
                    href={`https://t.me/${botUsername}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-primary hover:underline"
                  >
                    @{botUsername}
                  </a>{" "}
                  до вашого Telegram каналу
                </li>
                <li>Надайте боту права адміністратора з можливістю публікувати повідомлення</li>
                <li>Введіть username каналу (без @) або chat_id нижче</li>
              </ol>
            </AlertDescription>
          </Alert>

          <div className="flex justify-center my-6">
            <img 
              src={addBotInstruction} 
              alt="Підключення AI бота" 
              className="rounded-lg border shadow-sm max-w-full w-full object-contain"
            />
          </div>

          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <strong>Підключення каналу:</strong>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li><strong>Публічний:</strong> @username або https://t.me/username</li>
                <li><strong>Приватний:</strong> https://t.me/+xxx (наш агент для збору статистики приєднається автоматично. <strong className="text-destructive">Ні в якому разі не видаляйте його з каналу!</strong>)</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target-channel">Цільовий канал</Label>
              <p className="text-xs text-muted-foreground">
                Підтримуються всі формати: @channel, https://t.me/channel, https://t.me/+invite
              </p>
              <Input
                id="target-channel"
                placeholder="@channel, t.me/channel або t.me/+invite"
                value={targetChannel}
                onChange={(e) => {
                  const value = e.target.value;
                  setTargetChannel(value);
                  
                  // Валідація формату
                  if (value.trim() === "") {
                    setVerificationError(null);
                  } else if (
                    value.match(/^@[a-zA-Z0-9_]{5,32}$/) || // @username
                    value.match(/^-?\d{5,}$/) || // chat_id (мінімум 5 цифр)
                    value.match(/^https?:\/\/(t\.me|telegram\.me)\/[a-zA-Z0-9_]{5,}$/) || // https://t.me/username
                    value.match(/^https?:\/\/(t\.me|telegram\.me)\/\+[a-zA-Z0-9_-]{10,}$/) || // https://t.me/+invite
                    value.match(/^https?:\/\/(t\.me|telegram\.me)\/joinchat\/[a-zA-Z0-9_-]{10,}$/) // https://t.me/joinchat/xxx
                  ) {
                    setVerificationError(null);
                  } else {
                    setVerificationError("Невірний формат. Використовуйте @username, chat_id або t.me посилання");
                  }
                }}
                className={verificationError ? "border-destructive" : ""}
              />
            </div>

            {/* Verification Progress */}
            {isCheckingBot && verificationSteps.length > 0 && (
              <div className="space-y-3">
                <div className="space-y-2">
                  {verificationSteps.map((step, index) => (
                    <div key={index} className="flex items-center gap-2 text-sm">
                      {index < verificationCurrentStep ? (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      ) : index === verificationCurrentStep ? (
                        <Loader2 className="w-5 h-5 text-primary animate-spin flex-shrink-0" />
                      ) : (
                        <div className="w-5 h-5 rounded-full border-2 border-muted flex-shrink-0" />
                      )}
                      <span className={index <= verificationCurrentStep ? "text-foreground" : "text-muted-foreground"}>
                        {step}
                      </span>
                    </div>
                  ))}
                </div>
                
                <div className="space-y-2">
                  <div className="h-2 bg-primary/20 rounded-full overflow-hidden relative">
                    <div 
                      className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full transition-all duration-500"
                      style={{ width: `${((verificationCurrentStep + 1) / verificationSteps.length) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    Крок {verificationCurrentStep + 1} з {verificationSteps.length}
                  </p>
                </div>
              </div>
            )}

            <Button 
              onClick={handleVerifyChannel} 
              disabled={isCheckingBot || !targetChannel || !!verificationError}
              className="w-full"
            >
              {isCheckingBot ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Перевірка...
                </>
              ) : (
                "Підтвердити канал"
              )}
            </Button>
            
          </div>
        </div>
      </Card>
      </>
    );
  }

  return (
    <div className="space-y-6">
      {channelInfo && (
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarImage src={channelInfo.photo_url} />
              <AvatarFallback>
                <Bot className="w-8 h-8" />
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h3 className="text-xl font-bold">{channelInfo.title}</h3>
              {channelInfo.username && (
                <p className="text-sm text-muted-foreground">@{channelInfo.username}</p>
              )}
              {channelInfo.members_count && (
                <p className="text-sm text-muted-foreground">{channelInfo.members_count.toLocaleString()} підписників</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-500" />
              {service?.is_running && (
                <Badge variant="default" className="gap-1">
                  <Play className="w-3 h-3" />
                  Активний
                </Badge>
              )}
            </div>
          </div>
        </Card>
      )}


      <Card className="p-6">
        <h3 className="text-lg font-bold flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5" />
          Налаштування генерації
        </h3>
        
        <div className="space-y-6">
            <div className="space-y-6">
          
          {/* Warning alert about settings changes - only show when editing existing service */}
          {service && (
            <Alert variant="default" className="border-amber-500/50 bg-amber-500/10">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <AlertDescription className="text-sm">
                При зміні категорій або промта всі згенеровані публікації будуть очищені та згенеровані заново з новими налаштуваннями.
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="custom-prompt">Власний промт</Label>
                <p className="text-sm text-muted-foreground">
                  Використовувати власний промт замість категорій
                </p>
              </div>
              <Switch
                id="custom-prompt"
                checked={useCustomPrompt}
                onCheckedChange={(checked) => {
                  setUseCustomPrompt(checked);
                  if (checked) {
                    setSelectedCategories([]);
                    setSelectedCategoryObjects([]);
                  }
                }}
              />
            </div>

            {useCustomPrompt && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="prompt-text">Опис промта</Label>
                <Input
                  id="prompt-text"
                  placeholder="Наприклад: Створи пост про мотивацію для підприємців..."
                  value={customPrompt}
                  onChange={(e) => {
                    setCustomPrompt(e.target.value);
                    setHasUnsavedChanges(true);
                  }}
                  disabled={!useCustomPrompt}
                />
                <p className="text-sm text-muted-foreground">
                  Коротко опишіть тему або стиль постів які хочете генерувати
                </p>
              </div>
            )}
          </div>

          {!useCustomPrompt && (
            <div className="space-y-2">
              <Label>Категорії (максимум 5)</Label>
              <p className="text-sm text-muted-foreground mb-3">
                Оберіть категорії для автоматичної генерації публікацій
              </p>
            
            {selectedCategoryObjects.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-3">
                {selectedCategoryObjects.map((cat) => (
                  <Badge key={cat.value} variant="secondary" className="gap-1 items-center">
                    {getCategoryIcon(cat.emoji, "w-3.5 h-3.5")}
                    <span>{cat.label}</span>
                    <X
                      className="w-3 h-3 cursor-pointer hover:text-destructive"
                      onClick={() => {
                        setSelectedCategories(selectedCategories.filter(c => c !== cat.value));
                        setSelectedCategoryObjects(selectedCategoryObjects.filter(c => c.value !== cat.value));
                      }}
                    />
                  </Badge>
                ))}
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[300px] overflow-y-auto p-2 border rounded-md">
              {postCategories.map((category) => {
                const isSelected = selectedCategories.includes(category.value);
                return (
                  <Button
                    key={category.value}
                    variant={isSelected ? "default" : "outline"}
                    size="sm"
                    className="justify-start"
                    disabled={useCustomPrompt}
                    onClick={() => {
                      if (selectedCategories.length >= 5 && !isSelected) {
                        toast({
                          title: "Ліміт досягнуто",
                          description: "Можна обрати максимум 5 категорій",
                          variant: "destructive",
                        });
                        return;
                      }
                      
                      if (isSelected) {
                        setSelectedCategories(selectedCategories.filter(c => c !== category.value));
                        setSelectedCategoryObjects(selectedCategoryObjects.filter(c => c.value !== category.value));
                      } else {
                        setSelectedCategories([...selectedCategories, category.value]);
                        setSelectedCategoryObjects([...selectedCategoryObjects, category]);
                      }
                    }}
                  >
                    <span className="mr-2">{getCategoryIcon(category.emoji, "w-4 h-4 inline-block")}</span>
                    <span className="text-xs">{category.label}</span>
                  </Button>
                );
              })}
            </div>
            </div>
          )}

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium">Фільтри публікації</h4>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="time-filter">Публікувати в певний час</Label>
              <Switch
                id="time-filter"
                checked={enableTimeFilter}
                onCheckedChange={setEnableTimeFilter}
              />
            </div>

            {enableTimeFilter && (
              <div className="grid grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="time-from">З</Label>
                  <Input
                    id="time-from"
                    type="time"
                    value={timeFrom}
                    onChange={(e) => {
                      setTimeFrom(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    disabled={!enableTimeFilter}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="time-to">До</Label>
                  <Input
                    id="time-to"
                    type="time"
                    value={timeTo}
                    onChange={(e) => {
                      setTimeTo(e.target.value);
                      setHasUnsavedChanges(true);
                    }}
                    disabled={!enableTimeFilter}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="timer-publish">Відкладена публікація</Label>
                <p className="text-sm text-muted-foreground">
                  Публікувати пости автоматично через інтервал
                </p>
              </div>
              <Switch
                id="timer-publish"
                checked={enableTimerPublish}
                onCheckedChange={setEnableTimerPublish}
              />
            </div>

            {enableTimerPublish && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="post-interval">Інтервал публікації (хвилин)</Label>
                <Input
                  id="post-interval"
                  type="text"
                  inputMode="numeric"
                  value={postInterval}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || /^\d*$/.test(value)) {
                      setPostInterval(value === '' ? '' : parseInt(value));
                      setHasUnsavedChanges(true);
                    }
                  }}
                  onBlur={(e) => {
                    const value = parseInt(e.target.value) || 60;
                    setPostInterval(Math.max(60, Math.min(300, value)));
                  }}
                  onFocus={(e) => e.target.select()}
                  disabled={!enableTimerPublish}
                  placeholder="60"
                />
                <p className="text-sm text-muted-foreground">
                  {postInterval === 60 ? 'За замовчуванням' : `${postInterval} хвилин`} (від 60 до 300 хвилин)
                </p>
              </div>
            )}

            {userTariff?.allow_ai_images === true && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20">
                <div>
                  <Label htmlFor="include-media" className="font-medium">Публікації з зображенням</Label>
                  <p className="text-sm text-muted-foreground">
                    Генерувати зображення для постів через AI
                  </p>
                </div>
                <Switch
                  id="include-media"
                  checked={includeMedia}
                  onCheckedChange={setIncludeMedia}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="generate-tags">Генерувати теги</Label>
                <p className="text-sm text-muted-foreground">
                  Додавати хештеги до постів автоматично
                </p>
              </div>
              <Switch
                id="generate-tags"
                checked={generateTags}
                onCheckedChange={setGenerateTags}
              />
            </div>
          </div>

              <Button onClick={handleSaveSettings} disabled={isSaving} className="w-full">
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Збереження...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 mr-2" />
                    Зберегти налаштування
                  </>
                )}
              </Button>
            </div>
          </div>
        </Card>
    </div>
  );
};