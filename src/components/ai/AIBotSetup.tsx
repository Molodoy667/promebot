// @ts-nocheck
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sparkles, Save, Loader2, CheckCircle2, Info, HelpCircle, Bot, Play, Square, X, ChevronDown, ChevronUp, Pause } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
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

export const AIBotSetup = ({ botId, botUsername, botToken, userId, serviceId }: AIBotSetupProps) => {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingBot, setIsCheckingBot] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState("");
  const [postCategories, setPostCategories] = useState<CategoryOption[]>([]);
  
  const [targetChannel, setTargetChannel] = useState("");
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
  
  const [includeMedia, setIncludeMedia] = useState(true);
  const [useCustomPrompt, setUseCustomPrompt] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [generateTags, setGenerateTags] = useState(false);
  
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [postsOpen, setPostsOpen] = useState(true);
  const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);
  const [showStats, setShowStats] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);

  useEffect(() => {
    const initializeData = async () => {
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
    setVerificationProgress("🔍 Крок 1/4: Перевірка формату каналу...");

    try {
      // Парсимо і нормалізуємо канал
      const parsed = parseTelegramChannel(targetChannel);
      
      if (!parsed.isValid) {
        toast({
          title: "Невірний формат каналу",
          description: parsed.error || "Перевірте формат каналу",
          variant: "destructive",
        });
        setIsCheckingBot(false);
        return;
      }

      // Оновлюємо targetChannel на нормалізований формат
      const normalizedChannel = parsed.normalized;
      setTargetChannel(normalizedChannel);
      
      // Перевірка: чи вже підключено цей канал до цього самого AI бота
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
          duration: 8000,
        });
        setIsCheckingBot(false);
        return;
      }
      
      // Check if channel is already taken іншим користувачем
      const { data: ownerCheck, error: ownerError } = await supabase
        .rpc('check_channel_ownership', { 
          channel_identifier: normalizedChannel,
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
        return;
      }
      
      let channelIdentifier = normalizedChannel.replace('@', '');
      
      if (channelIdentifier.includes('t.me/+') || channelIdentifier.includes('t.me/joinchat/')) {
        setVerificationProgress("🔐 Крок 2/4: Підключення до приватного каналу...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const checkResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getChat?chat_id=${channelIdentifier}`
        );
        const checkData = await checkResponse.json();

        if (!checkData.ok) {
          setVerificationStatus({ isMember: false, hasPermissions: false });
          toast({
            title: "Помилка доступу",
            description: `Бот не має доступу до каналу. Переконайтеся що ви додали бота @${botUsername} як адміністратора`,
            variant: "destructive",
            duration: 6000,
          });
          setIsCheckingBot(false);
          return;
        }

        setVerificationStatus({ isMember: true, hasPermissions: null });
        setVerificationProgress("🔑 Крок 3/4: Перевірка прав адміністратора...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const botIdNum = botToken.split(':')[0];
        const memberResponse = await fetch(
          `https://api.telegram.org/bot${botToken}/getChatMember?chat_id=${channelIdentifier}&user_id=${botIdNum}`
        );
        const memberData = await memberResponse.json();

        if (!memberData.ok || (memberData.result.status !== 'administrator' && memberData.result.status !== 'creator')) {
          setVerificationStatus({ isMember: true, hasPermissions: false });
          toast({
            title: "Недостатньо прав",
            description: "Бот доданий до каналу, але не має прав адміністратора.",
            variant: "destructive",
            duration: 5000,
          });
          setIsCheckingBot(false);
          return;
        }

        setVerificationStatus({ isMember: true, hasPermissions: true });
        setVerificationProgress("✅ Крок 4/4: Завершення налаштування...");
        await new Promise(resolve => setTimeout(resolve, 800));
        setVerificationProgress("🎉 Успішно підключено!");
        await new Promise(resolve => setTimeout(resolve, 600));

        setChannelVerified(true);
        await loadChannelInfo(channelIdentifier);
        toast({
          title: "Успішно!",
          description: `AI бот підключений до приватного каналу "${checkData.result.title}"`,
          duration: 3000,
        });
      } else {
        setVerificationProgress("🌐 Крок 2/4: Перевірка публічного каналу...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const { data, error } = await supabase.functions.invoke('check-bot-admin', {
          body: {
            botToken: botToken,
            channelUsername: channelIdentifier,
          },
        });

        if (error) throw error;

        if (!data.isMember) {
          setVerificationStatus({ isMember: false, hasPermissions: false });
          toast({
            title: "Бот не доданий",
            description: `Будь ласка, додайте бота @${botUsername} до каналу @${channelIdentifier}`,
            variant: "destructive",
            duration: 5000,
          });
          setIsCheckingBot(false);
          return;
        }

        setVerificationStatus({ isMember: true, hasPermissions: null });
        setVerificationProgress("🔑 Крок 3/4: Перевірка прав адміністратора...");
        await new Promise(resolve => setTimeout(resolve, 1000));

        if (!data.isAdmin) {
          setVerificationStatus({ isMember: true, hasPermissions: false });
          toast({
            title: "Недостатньо прав",
            description: "Бот доданий до каналу, але не має прав адміністратора.",
            variant: "destructive",
            duration: 5000,
          });
          setIsCheckingBot(false);
          return;
        }

        setVerificationStatus({ isMember: true, hasPermissions: true });
        setVerificationProgress("✅ Крок 4/4: Завершення налаштування...");
        await new Promise(resolve => setTimeout(resolve, 800));
        setVerificationProgress("🎉 Успішно підключено!");
        await new Promise(resolve => setTimeout(resolve, 600));

        setChannelVerified(true);
        await loadChannelInfo(`@${channelIdentifier}`);
        toast({
          title: "Успішно!",
          description: `AI бот підключений до каналу @${channelIdentifier}`,
          duration: 3000,
        });
      }
    } catch (error: any) {
      console.error("Error verifying channel:", error);
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося перевірити канал",
        variant: "destructive",
      });
    } finally {
      setIsCheckingBot(false);
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

    // Check if categories or prompt changed
    const categoriesChanged = JSON.stringify(selectedCategories.sort()) !== JSON.stringify(originalSettings.categories.sort());
    const promptModeChanged = useCustomPrompt !== originalSettings.useCustomPrompt;
    const promptTextChanged = useCustomPrompt && customPrompt !== originalSettings.customPrompt;
    const contentSettingsChanged = categoriesChanged || promptModeChanged || promptTextChanged;

    // Check if any other settings changed
    const timeFilterChanged = enableTimeFilter !== originalSettings.enableTimeFilter;
    const timeFromChanged = timeFrom !== originalSettings.timeFrom;
    const timeToChanged = timeTo !== originalSettings.timeTo;
    const intervalChanged = postInterval !== originalSettings.postInterval;
    const mediaChanged = includeMedia !== originalSettings.includeMedia;
    const tagsChanged = generateTags !== originalSettings.generateTags;
    const otherSettingsChanged = timeFilterChanged || timeFromChanged || timeToChanged || intervalChanged || mediaChanged || tagsChanged;

    const anySettingsChanged = contentSettingsChanged || otherSettingsChanged;

    // Show warning if content settings changed and there are scheduled posts
    if (contentSettingsChanged && service?.id && generatedPosts.length > 0) {
      const confirmed = window.confirm(
        "⚠️ Увага!\n\nПри зміні категорій або власного промпта всі вже згенеровані пости будуть очищені.\n\nПродовжити?"
      );
      
      if (!confirmed) {
        // Restore original settings on cancel
        setSelectedCategories(originalSettings.categories);
        const categoryObjs = postCategories.filter(c => originalSettings.categories.includes(c.value));
        setSelectedCategoryObjects(categoryObjs);
        setUseCustomPrompt(originalSettings.useCustomPrompt);
        setCustomPrompt(originalSettings.customPrompt);
        setEnableTimeFilter(originalSettings.enableTimeFilter);
        setTimeFrom(originalSettings.timeFrom);
        setTimeTo(originalSettings.timeTo);
        setPostInterval(originalSettings.postInterval);
        setIncludeMedia(originalSettings.includeMedia);
        setGenerateTags(originalSettings.generateTags);
        setHasUnsavedChanges(false);
        return;
      }
    }

    // Show warning if bot is running and any settings changed
    if (service?.is_running && anySettingsChanged) {
      const confirmed = window.confirm(
        "⚠️ Увага!\n\nБот зараз активний. При зміні налаштувань бот буде зупинено" + 
        (contentSettingsChanged ? " і всі згенеровані пости будуть очищені" : "") + 
        ".\n\nПродовжити?"
      );
      
      if (!confirmed) {
        // Restore original settings on cancel
        setSelectedCategories(originalSettings.categories);
        const categoryObjs = postCategories.filter(c => originalSettings.categories.includes(c.value));
        setSelectedCategoryObjects(categoryObjs);
        setUseCustomPrompt(originalSettings.useCustomPrompt);
        setCustomPrompt(originalSettings.customPrompt);
        setEnableTimeFilter(originalSettings.enableTimeFilter);
        setTimeFrom(originalSettings.timeFrom);
        setTimeTo(originalSettings.timeTo);
        setPostInterval(originalSettings.postInterval);
        setIncludeMedia(originalSettings.includeMedia);
        setGenerateTags(originalSettings.generateTags);
        setHasUnsavedChanges(false);
        return;
      }
    }

    try {
      setIsSaving(true);

      // Clear scheduled posts ONLY when categories or prompt changed
      if (contentSettingsChanged && service?.id) {
        await supabase
          .from("ai_generated_posts")
          .delete()
          .eq("ai_bot_service_id", service.id)
          .eq("status", "scheduled");
        
        setGeneratedPosts([]);
      }

      // Stop service if running and ANY settings changed
      if (anySettingsChanged && service?.is_running) {
        await supabase
          .from("ai_bot_services")
          .update({ is_running: false })
          .eq("id", service.id);

        setService({ ...service, is_running: false });
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

        // Create new service for new channel
        const { data: newService, error: serviceError } = await supabase
          .from("ai_bot_services")
          .insert({
            user_id: userId,
            bot_id: botId,
            target_channel: normalizedChannel,
            service_type: "category_generation",
          })
          .select()
          .single();

        if (serviceError) throw serviceError;
        serviceId = newService.id;
        setService(newService as AIBotService);
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
      
      toast({
        title: "Успішно",
        description: "Налаштування збережено",
      });
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
      
      if (newRunningState) {
        // Check how many posts are already in queue
        const { data: existingPosts, error: countError } = await supabase
          .from("ai_generated_posts")
          .select("id", { count: 'exact', head: true })
          .eq("ai_bot_service_id", service.id)
          .eq("status", "scheduled");

        if (countError) throw countError;

        const postsCount = existingPosts || 0;
        console.log('Posts in queue:', postsCount);

        // If queue is full (10 posts), don't generate more
        if (postsCount >= 10) {
          toast({
            title: "Черга заповнена",
            description: "У черзі вже 10 постів. Бот продовжить публікацію існуючих постів.",
            duration: 5000,
          });
        } else {
          // If this is first start (no posts yet), generate initial 5 posts
          if (postsCount === 0) {
            console.log('First start - generating 5 initial posts');
            await supabase.functions.invoke("generate-ai-posts", {
              body: { serviceId: service.id, count: 5 },
            });
          }
          // Otherwise, standard logic will handle generation (via cron/worker)
        }
      }
      
      const { error } = await supabase
        .from("ai_bot_services")
        .update({ 
          is_running: newRunningState,
          started_at: newRunningState ? now : service.started_at
        })
        .eq("id", service.id);

      if (error) throw error;

      // Створюємо сповіщення через прямий INSERT
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔔 AI Bot notification - User:', user?.id);
      if (user) {
        console.log('🤖 Service name:', service.name, 'Channel:', service.channel_name);
        
        // Перевіряємо налаштування
        const { data: settings } = await supabase
          .from('notification_settings')
          .select('bot_status_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        const isEnabled = settings?.bot_status_enabled ?? true;
        
        if (isEnabled) {
          if (newRunningState) {
            // Бот запущено
            console.log('▶️ Creating bot_started for AI via INSERT...');
            await supabase.from('notifications').insert({
              user_id: user.id,
              type: 'bot_started',
              title: 'Бот запущено',
              message: `Бот "${service.name || 'AI Бот'}" прив'язаний до каналу "${service.channel_name}" розпочав свою роботу`,
              link: '/my-channels'
            });
            console.log('✅ AI notification created');
          } else {
            // Бот зупинено
            console.log('⏸️ Creating bot_stopped for AI via INSERT...');
            const runtimeHours = service.started_at 
              ? (Date.now() - new Date(service.started_at).getTime()) / (1000 * 60 * 60)
              : 0;
            console.log('⏱️ AI Runtime hours:', runtimeHours);
            
            let runtimeText;
            if (runtimeHours >= 24) {
              runtimeText = `${Math.floor(runtimeHours / 24)} днів ${Math.floor(runtimeHours % 24)} годин`;
            } else if (runtimeHours >= 1) {
              runtimeText = `${Math.floor(runtimeHours)} годин ${Math.round((runtimeHours % 1) * 60)} хвилин`;
            } else {
              runtimeText = `${Math.round(runtimeHours * 60)} хвилин`;
            }
            
            await supabase.from('notifications').insert({
              user_id: user.id,
              type: 'bot_stopped',
              title: 'Бот зупинено',
              message: `Бот "${service.name || 'AI Бот'}" прив'язаний до каналу "${service.channel_name}" припинив свою роботу, пропрацювавши ${runtimeText}`,
              link: '/my-channels'
            });
            console.log('✅ AI notification created');
          }
        }
      } else {
        console.warn('⚠️ AI Bot: User not found, cannot create notification');
      }

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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!channelVerified) {
    return (
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
                <li><strong>Публічний канал:</strong> введіть username (наприклад: <code>mychannel</code>)</li>
                <li><strong>Приватний канал:</strong> використовуйте числовий chat_id (наприклад: <code>-1001234567890</code>)</li>
              </ul>
            </AlertDescription>
          </Alert>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="target-channel">Цільовий канал</Label>
              <p className="text-xs text-muted-foreground">
                Підтримуються всі формати: @channel, channel, https://t.me/channel, -1001234567890
              </p>
              <div className="flex gap-2">
                <Input
                  id="target-channel"
                  placeholder="@channel, t.me/channel або -1001234567890"
                  value={targetChannel}
                  onChange={(e) => setTargetChannel(e.target.value)}
                />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon">
                      <HelpCircle className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80">
                    <div className="space-y-2">
                      <h4 className="font-medium">Як отримати chat_id?</h4>
                      <p className="text-sm text-muted-foreground">
                        Для приватних каналів потрібен chat_id. Щоб його отримати:
                      </p>
                      <ol className="list-decimal list-inside text-sm space-y-1">
                        <li>Перешліть будь-яке повідомлення з каналу боту <code>@userinfobot</code></li>
                        <li>Або використайте <code>@JsonDumpBot</code> - він покаже структуру повідомлення</li>
                        <li>Chat_id буде в полі "forward_from_chat" → "id"</li>
                      </ol>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>


            <Button 
              onClick={handleVerifyChannel} 
              disabled={isCheckingBot || !targetChannel}
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
                        <h3 className="text-xl font-semibold">Перевірка AI бота...</h3>
                        <p className="text-muted-foreground text-sm">
                          {verificationProgress || "Перевіряємо підключення до каналу"}
                        </p>
                      </div>
                      
                      <div className="w-full space-y-2">
                        <div className="h-2 bg-primary/20 rounded-full overflow-hidden relative">
                          <div 
                            className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full absolute inset-0 animate-loading-bar"
                          />
                        </div>
                        <p className="text-xs text-center text-muted-foreground">
                          Будь ласка, зачекайте...
                        </p>
                      </div>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </div>
        </div>
      </Card>
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


      <Collapsible open={settingsOpen} onOpenChange={setSettingsOpen}>
        <Card className="p-6">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full flex items-center justify-between p-0 hover:bg-transparent">
              <h3 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5" />
                Налаштування генерації
              </h3>
              {settingsOpen ? (
                <ChevronUp className="w-5 h-5" />
              ) : (
                <ChevronDown className="w-5 h-5" />
              )}
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-4">
            <div className="space-y-6">
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
                  <Badge key={cat.value} variant="secondary" className="gap-1">
                    <span>{cat.emoji}</span>
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
                  value={postInterval}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || !isNaN(parseInt(value))) {
                      const numValue = parseInt(value) || 60;
                      setPostInterval(Math.max(60, Math.min(300, numValue)));
                      setHasUnsavedChanges(true);
                    }
                  }}
                  disabled={!enableTimerPublish}
                  placeholder="60"
                />
                <p className="text-sm text-muted-foreground">
                  {postInterval === 60 ? 'За замовчуванням' : `${postInterval} хвилин`} (від 60 до 300 хвилин)
                </p>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="include-media">Публікації з зображенням</Label>
              <Switch
                id="include-media"
                checked={includeMedia}
                onCheckedChange={setIncludeMedia}
              />
            </div>

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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {service?.is_running && (
        <Collapsible open={postsOpen} onOpenChange={setPostsOpen}>
          <Card className="p-6">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full flex items-center justify-between p-0 hover:bg-transparent mb-4">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <Bot className="w-5 h-5" />
                  Згенеровані публікації ({generatedPosts.length})
                </h3>
                {postsOpen ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </Button>
            </CollapsibleTrigger>

            <CollapsibleContent>
              {generatedPosts.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
                  <p>Генерація публікацій...</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {generatedPosts.map((post) => {
                    const category = postCategories.find(c => c.value === post.category);
                    const isExpanded = expandedPostId === post.id;
                    const postContent = post.post_content || post.content || '';
                    const shortText = postContent.length > 140
                      ? postContent.slice(0, 140) + "..."
                      : postContent;
                    return (
                      <Card key={post.id} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {category && (
                                <Badge variant="secondary">
                                  <span className="flex items-center gap-2">
                                    {getCategoryIcon(category.emoji, "w-4 h-4")}
                                    {category.label}
                                  </span>
                                </Badge>
                              )}
                              <Badge variant={post.status === "pending" ? "outline" : "default"}>
                                {post.status === "pending" ? "Очікує" : "Заплановано"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  setExpandedPostId(isExpanded ? null : post.id)
                                }
                              >
                                {isExpanded ? "Сховати" : "Детальніше"}
                              </Button>
                            </div>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">
                            {isExpanded ? postContent : shortText}
                          </p>
                          <div className="text-xs text-muted-foreground space-y-1">
                            <div>Створено: {new Date(post.created_at).toLocaleString('uk-UA', { 
                              year: 'numeric', 
                              month: '2-digit', 
                              day: '2-digit', 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}</div>
                            {post.status === 'scheduled' && (() => {
                              const settings = enableTimerPublish ? {
                                post_interval_minutes: postInterval,
                                time_from: enableTimeFilter ? timeFrom : '',
                                time_to: enableTimeFilter ? timeTo : '',
                              } : null;
                              
                              const nextPublishTime = calculateNextPublishTime(
                                generatedPosts,
                                post,
                                settings
                              );
                              return (
                                <div className="text-primary font-medium">
                                  🕐 Публікація: {nextPublishTime ? new Date(nextPublishTime).toLocaleString('uk-UA', { 
                                    year: 'numeric',
                                    month: '2-digit',
                                    day: '2-digit',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  }) : 'очікує'}
                                </div>
                              );
                            })()}
                          </div>
                          {isExpanded && post.image_url && (
                            <div className="mt-3">
                              <img 
                                src={post.image_url} 
                                alt="AI згенероване зображення" 
                                className="rounded-md max-w-full h-auto shadow-lg"
                              />
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  );
};