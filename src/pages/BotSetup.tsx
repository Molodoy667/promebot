// @ts-nocheck
import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BotSelector } from "@/components/BotSelector";
import { BotCategoriesPanel } from "@/components/BotCategoriesPanel";
import { ChannelInfo } from "@/components/ChannelInfo";
import { AIBotSetup } from "@/components/ai/AIBotSetup";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Bot, 
  Play,
  Pause,
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Zap,
  Info,
  FileText,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/components/ui/use-toast";
import { Separator } from "@/components/ui/separator";
import addBotInstruction from "@/assets/add-bot-instruction.jpg";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";

interface BotService {
  id: string;
  bot_id?: string | null;
  target_channel: string;
  posts_per_day: number;
  post_interval_minutes: number;
  include_media: boolean;
  post_as_bot: boolean;
  is_running: boolean;
  keywords_filter: any;
  publish_immediately: boolean;
  publish_old_posts: boolean;
  subscription_id: string | null;
  allow_auto_delete?: boolean;
  allow_custom_watermark?: boolean;
  allow_link_preview?: boolean;
  allow_forward_tag?: boolean;
  allow_edit_before_post?: boolean;
}

interface Tariff {
  id: string;
  name: string;
  posts_per_day: number;
  channels_limit: number;
  bots_limit?: number;
  sources_limit?: number;
  allow_media?: boolean;
  allow_new_posts_only?: boolean;
  allow_keyword_filter?: boolean;
  allow_scheduled_posting?: boolean;
  allow_post_as_channel?: boolean;
  allow_auto_delete?: boolean;
  allow_custom_watermark?: boolean;
  allow_link_preview?: boolean;
  allow_forward_tag?: boolean;
  allow_edit_before_post?: boolean;
}

interface SourceChannel {
  id: string;
  channel_username: string;
  is_active: boolean;
}

interface TelegramBot {
  id: string;
  bot_token: string;
  bot_name: string | null;
  bot_username: string | null;
  bot_type: 'ai' | 'plagiarist' | null;
  status: string | null;
  is_active: boolean | null;
  posts_count: number | null;
  channels_count: number | null;
  last_activity_at: string | null;
  users_count?: number | null;
}

const BotSetup = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isCheckingBot, setIsCheckingBot] = useState(false);
  const [verificationProgress, setVerificationProgress] = useState("");
  
  const [bots, setBots] = useState<TelegramBot[]>([]);
  const [selectedBotId, setSelectedBotId] = useState<string | null>(null);
  const [botVerified, setBotVerified] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<{
    isMember: boolean | null;
    hasPermissions: boolean | null;
  }>({ isMember: null, hasPermissions: null });
  
  const [botService, setBotService] = useState<BotService | null>(null);
  const [sourceChannels, setSourceChannels] = useState<SourceChannel[]>([]);
  const [pendingSourceChannels, setPendingSourceChannels] = useState<{
    username: string, 
    title?: string, 
    photo_url?: string,
    is_private?: boolean,
    invite_hash?: string,
    spy_id?: string
  }[]>([]); // Локальні джерела до збереження
  const [newChannelUsername, setNewChannelUsername] = useState("");
  const [newChannelType, setNewChannelType] = useState<"public" | "private">("public");
  const [inviteLink, setInviteLink] = useState("");
  const [keywords, setKeywords] = useState("");
  const [targetChannel, setTargetChannel] = useState("");
  const [targetChannelType, setTargetChannelType] = useState<"public" | "private">("public");
  const [targetInviteLink, setTargetInviteLink] = useState("");
  const [tariff, setTariff] = useState<Tariff | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [useKeywordFilter, setUseKeywordFilter] = useState(false);
  const [isCheckingChannel, setIsCheckingChannel] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [channelVerificationStatus, setChannelVerificationStatus] = useState<{
    canRead: boolean | null;
    isPublic: boolean | null;
  }>({ canRead: null, isPublic: null });
  
  // Статистика використання для відображення лімітів
  const [usageStats, setUsageStats] = useState({
    botsUsed: 0,
    channelsUsed: 0,
    sourcesUsed: 0,
    postsToday: 0
  });

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      await loadUserBots(session.user.id);
      await loadUserTariff(session.user.id); // Завантажуємо тариф окремо
      await loadUsageStats(session.user.id);
      
      // Check if we have a specific botServiceId (plagiarist) or aiServiceId (AI) in location state
      const botServiceId = location.state?.botServiceId;
      const aiServiceId = location.state?.aiServiceId;
      
      if (botServiceId) {
        await loadSpecificBotService(session.user.id, botServiceId);
      } else if (aiServiceId) {
        await loadAIBotService(session.user.id, aiServiceId);
      } else {
        await loadBotService(session.user.id);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadUserBots(session.user.id);
        const botServiceId = location.state?.botServiceId;
        const aiServiceId = location.state?.aiServiceId;
        if (botServiceId) {
          loadSpecificBotService(session.user.id, botServiceId);
        } else if (aiServiceId) {
          loadAIBotService(session.user.id, aiServiceId);
        } else {
          loadBotService(session.user.id);
        }
      }
    });

    // Підписка на реал-тайм зміни ботів
    const botsChannel = supabase
      .channel('telegram_bots_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telegram_bots',
        },
        (payload) => {
          console.log('Bot changed:', payload);
          if (user) {
            loadUserBots(user.id);
          }
        }
      )
      .subscribe();

    // Bot services updates
    const botServicesChannel = supabase
      .channel('bot_services_setup_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bot_services',
        },
        () => {
          console.log('Bot service changed, reloading...');
          if (user) {
            const botServiceId = location.state?.botServiceId;
            if (botServiceId) {
              loadSpecificBotService(user.id, botServiceId);
            } else {
              loadBotService(user.id);
            }
          }
        }
      )
      .subscribe();

    // Source channels updates
    const sourceChannelsChannel = supabase
      .channel('source_channels_setup_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'source_channels',
        },
        (payload) => {
          console.log('Source channel changed:', payload);
          if (botService?.id) {
            loadSourceChannels(botService.id);
          }
        }
      )
      .subscribe();

    // Subscriptions updates
    const subscriptionsSetupChannel = supabase
      .channel('subscriptions_setup_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        () => {
          console.log('Subscription changed, reloading bot service...');
          if (user) {
            const botServiceId = location.state?.botServiceId;
            if (botServiceId) {
              loadSpecificBotService(user.id, botServiceId);
            } else {
              loadBotService(user.id);
            }
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
      supabase.removeChannel(botsChannel);
      supabase.removeChannel(botServicesChannel);
      supabase.removeChannel(sourceChannelsChannel);
      supabase.removeChannel(subscriptionsSetupChannel);
    };
  }, [navigate, location.state]);

  const loadUserTariff = async (userId: string) => {
    try {
      // Завантажуємо активну підписку користувача
      const { data: subscription, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          tariffs(*)
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (subscription?.tariffs) {
        const rawTariff: any = subscription.tariffs;
        const computedPostsPerDay =
          rawTariff.posts_per_day ??
          (rawTariff.posts_per_month
            ? Math.floor(rawTariff.posts_per_month / (rawTariff.duration_days || 30))
            : 0);

        console.log("✅ Тариф завантажено:", rawTariff);
        setTariff({ ...rawTariff, posts_per_day: computedPostsPerDay });
      } else {
        console.log("⚠️ Тариф не знайдено. Subscription:", subscription);
      }
    } catch (error) {
      console.error("❌ Помилка завантаження тарифу:", error);
    }
  };

  const loadUsageStats = async (userId: string) => {
    try {
      // Отримуємо кешовані дані з таблиці profiles
      const { data: userData, error } = await supabase
        .from("profiles")
        .select("bots_used_count, channels_used_count, sources_used_count, posts_current_period")
        .eq("id", userId)
        .single();
      
      if (error) {
        console.error("Помилка завантаження статистики:", error);
        return;
      }
      
      setUsageStats({
        botsUsed: userData?.bots_used_count || 0,
        channelsUsed: userData?.channels_used_count || 0,
        sourcesUsed: userData?.sources_used_count || 0,
        postsToday: userData?.posts_current_period || 0
      });
    } catch (error) {
      console.error("Помилка завантаження статистики використання:", error);
    }
  };

  const loadUserBots = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("telegram_bots")
        .select("id, bot_token, bot_name, bot_username, bot_type, status, is_active, posts_count, channels_count, users_count, last_activity_at")
        .eq("is_active", true);

      if (error) throw error;

      // Розрахувати статистику для кожного бота окремо
      const botsWithStats = await Promise.all((data || []).map(async (bot) => {
        let postsCount = 0;
        let channelsCount = 0;
        let usersCount = 0;

        // Рахуємо користувачів які використовують цей бот на сайті
        if (bot.bot_type === 'plagiarist') {
          // Для plagiarist - всі користувачі які мають bot_services
          const { data: uniqueUsers } = await supabase
            .from("bot_services")
            .select("user_id");
          
          const uniqueUserIds = new Set(uniqueUsers?.map(s => s.user_id) || []);
          usersCount = uniqueUserIds.size;
        } else if (bot.bot_type === 'ai') {
          // Для AI бота - користувачі які мають ai_bot_services для цього бота
          const { data: uniqueUsers } = await supabase
            .from("ai_bot_services")
            .select("user_id")
            .eq("bot_id", bot.id);
          
          const uniqueUserIds = new Set(uniqueUsers?.map(s => s.user_id) || []);
          usersCount = uniqueUserIds.size;
        }

        if (bot.bot_type === 'plagiarist') {
          // Рахуємо канали для плагіатор бота (всі bot_services користувача)
          const { count: servicesCount } = await supabase
            .from("bot_services")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", userId);
          channelsCount = servicesCount || 0;

          // Рахуємо ВСІ пости (не тільки published)
          const { data: services } = await supabase
            .from("bot_services")
            .select("id")
            .eq("user_id", userId);
          
          if (services && services.length > 0) {
            const { count: posts } = await supabase
              .from("posts_history")
              .select("*", { count: 'exact', head: true })
              .in("bot_service_id", services.map(s => s.id));
            postsCount = posts || 0;
          }
        } else if (bot.bot_type === 'ai') {
          // Рахуємо канали для AI бота
          const { count: aiServicesCount } = await supabase
            .from("ai_bot_services")
            .select("*", { count: 'exact', head: true })
            .eq("bot_id", bot.id)
            .eq("user_id", userId);
          channelsCount = aiServicesCount || 0;

          // Рахуємо пости
          const { data: aiServices } = await supabase
            .from("ai_bot_services")
            .select("id")
            .eq("bot_id", bot.id)
            .eq("user_id", userId);
          
          if (aiServices && aiServices.length > 0) {
            const { count: posts } = await supabase
              .from("ai_generated_posts")
              .select("*", { count: 'exact', head: true })
              .in("ai_bot_service_id", aiServices.map(s => s.id))
              .eq("status", "published");
            postsCount = posts || 0;
          }
        }

        return {
          ...bot,
          posts_count: postsCount,
          channels_count: channelsCount,
          users_count: usersCount
        };
      }));

      console.log("Bots with stats:", botsWithStats);
      setBots(botsWithStats || []);
    } catch (error: any) {
      console.error("Error loading bots:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadBotService = async (userId: string, botId?: string) => {
    try {
      let query = supabase
        .from("bot_services")
        .select(`
          *,
          subscription:subscriptions(
            id,
            tariff:tariffs(
              id,
              name,
              posts_per_month,
              duration_days,
              channels_limit,
              bots_limit,
              sources_limit
            )
          )
        `)
        .eq("user_id", userId);

      // If botId is provided, filter by it
      if (botId) {
        query = query.eq("bot_id", botId);
      }

      const { data: service, error } = await query.maybeSingle();

      if (error) throw error;

      if (service) {
        setBotService(service);
        setTargetChannel(service.target_channel);
        const keywordsArray = Array.isArray(service.keywords_filter) ? service.keywords_filter : [];
        setKeywords(keywordsArray.join(", "));
        setUseKeywordFilter(keywordsArray.length > 0);
        
        // Load tariff info
        if (service.subscription?.tariff) {
          const rawTariff: any = service.subscription.tariff;
          const computedPostsPerDay =
            rawTariff.posts_per_day ??
            (rawTariff.posts_per_month
              ? Math.floor(rawTariff.posts_per_month / (rawTariff.duration_days || 30))
              : 0);

          setTariff({ ...rawTariff, posts_per_day: computedPostsPerDay });
        }
        
        await loadSourceChannels(service.id);
      } else {
        // Reset if no service found
        setBotService(null);
        setTargetChannel("");
        setSourceChannels([]);
      }
    } catch (error: any) {
      console.error("Error loading bot service:", error);
    }
  };

  const loadSpecificBotService = async (userId: string, botServiceId: string) => {
    try {
      const { data: service, error } = await supabase
        .from("bot_services")
        .select(`
          *,
          subscription:subscriptions(
            id,
            tariff:tariffs(
              id,
              name,
              posts_per_month,
              duration_days,
              channels_limit,
              bots_limit,
              sources_limit
            )
          )
        `)
        .eq("id", botServiceId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      if (service) {
        setBotService(service);
        setTargetChannel(service.target_channel);
        const keywordsArray = Array.isArray(service.keywords_filter) ? service.keywords_filter : [];
        setKeywords(keywordsArray.join(", "));
        setUseKeywordFilter(keywordsArray.length > 0);
        
        // Load tariff info
        if (service.subscription?.tariff) {
          const rawTariff: any = service.subscription.tariff;
          const computedPostsPerDay =
            rawTariff.posts_per_day ??
            (rawTariff.posts_per_month
              ? Math.floor(rawTariff.posts_per_month / (rawTariff.duration_days || 30))
              : 0);

          setTariff({ ...rawTariff, posts_per_day: computedPostsPerDay });
        }
        
        await loadSourceChannels(service.id);
      }
    } catch (error: any) {
      console.error("Error loading specific bot service:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити налаштування каналу",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  const loadAIBotService = async (userId: string, aiServiceId: string) => {
    try {
      const { data: aiService, error } = await supabase
        .from("ai_bot_services")
        .select("bot_id")
        .eq("id", aiServiceId)
        .eq("user_id", userId)
        .single();

      if (error) throw error;

      if (aiService && aiService.bot_id) {
        // Auto-select the AI bot
        setSelectedBotId(aiService.bot_id);
        setBotVerified(true);
      }
    } catch (error: any) {
      console.error("Error loading AI bot service:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити налаштування AI бота",
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  // Auto-select bot when coming from My Channels page
  useEffect(() => {
    if (location.state?.botServiceId && bots.length > 0 && botService && !selectedBotId) {
      // For plagiarist bot, find the first plagiarist bot
      const plagiaristBot = bots.find(b => b.bot_type === 'plagiarist');
      if (plagiaristBot) {
        setSelectedBotId(plagiaristBot.id);
        setBotVerified(true);
      }
    }
  }, [location.state, bots, botService, selectedBotId]);

  const loadSourceChannels = async (botServiceId: string) => {
    try {
      const { data, error } = await supabase
        .from("source_channels")
        .select("*")
        .eq("bot_service_id", botServiceId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSourceChannels(data || []);
    } catch (error: any) {
      console.error("Error loading source channels:", error);
    }
  };

  const handleSelectBot = async (botId: string) => {
    setSelectedBotId(botId);
    setBotVerified(false);
    setVerificationStatus({ isMember: null, hasPermissions: null });
    
    // Load bot service for the selected bot
    if (user) {
      const selectedBot = bots.find(b => b.id === botId);
      if (selectedBot?.bot_type === 'plagiarist') {
        await loadBotService(user.id, botId);
      }
    }
  };

  const handleVerifyBot = async () => {
    if (!selectedBotId || !targetChannel) {
      toast({
        title: "Помилка",
        description: "Спочатку оберіть бота та вкажіть цільовий канал",
        variant: "destructive",
        duration: 1500,
      });
      return;
    }

    const selectedBot = bots.find(b => b.id === selectedBotId);
    if (!selectedBot) return;

    setIsCheckingBot(true);
    setVerificationStatus({ isMember: null, hasPermissions: null });
    setVerificationProgress("🔍 Крок 1/4: Перевірка формату каналу...");

    try {
      let channelIdentifier = targetChannel.trim();
      
      // Автоматично визначаємо приватний канал за invite-посиланням
      if (channelIdentifier.includes('t.me/+') || channelIdentifier.includes('t.me/joinchat/')) {
        setVerificationProgress("🔐 Крок 2/4: Підключення через userbot до приватного каналу...");
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Отримуємо активного spy
        const { data: activeSpy } = await supabase
          .from('telegram_spies')
          .select('id')
          .eq('is_active', true)
          .eq('is_authorized', true)
          .limit(1)
          .maybeSingle();

        if (!activeSpy) {
          toast({
            title: "Userbot недоступний",
            description: "Немає активного userbot для приватних каналів. Зверніться до адміністратора.",
            variant: "destructive",
            duration: 5000,
          });
          setIsCheckingBot(false);
          return;
        }

        // Викликаємо spy-get-channel-info
        const { data: spyData, error: spyError } = await supabase.functions.invoke('spy-get-channel-info', {
          body: {
            spy_id: activeSpy.id,
            channel_identifier: channelIdentifier
          }
        });

        if (spyError || !spyData?.success) {
          toast({
            title: "Помилка підключення",
            description: spyData?.error || "Не вдалося підключитись до приватного каналу",
            variant: "destructive",
            duration: 5000,
          });
          setIsCheckingBot(false);
          return;
        }

        setVerificationProgress("✅ Крок 3/4: Приватний канал підключено...");
        await new Promise(resolve => setTimeout(resolve, 800));

        // Зберігаємо chat_id з spy
        const chatId = spyData.channelInfo.id;
        setTargetChannel(chatId); // Зберігаємо numeric ID

        setVerificationStatus({ isMember: true, hasPermissions: true });
        setBotVerified(true);
        
        toast({
          title: "Успішно!",
          description: `Приватний канал "${spyData.channelInfo.title}" підключено через userbot`,
          duration: 3000,
        });
        
        setIsCheckingBot(false);
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
      if (user) {
        const { data: ownerCheck, error: ownerError } = await supabase
          .rpc('check_channel_ownership', { 
            channel_identifier: channelIdentifier,
            current_user_id: user.id 
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
      }
      
      // Check if it looks like a chat_id (numeric, possibly negative)
      const isChatId = /^-?\d+$/.test(channelIdentifier);
      
      if (isChatId) {
        // Handle as private channel with chat_id
        setVerificationProgress("🔐 Крок 2/4: Підключення до приватного каналу...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const checkResponse = await fetch(
          `https://api.telegram.org/bot${selectedBot.bot_token}/getChat?chat_id=${channelIdentifier}`
        );
        const checkData = await checkResponse.json();

        if (!checkData.ok) {
          setVerificationStatus({ isMember: false, hasPermissions: false });
          toast({
            title: "Помилка доступу",
            description: `Бот не має доступу до каналу. Переконайтеся що ви:\n1. Додали бота @${selectedBot.bot_username || 'вашого_бота'} як адміністратора\n2. Вказали правильний chat_id`,
            variant: "destructive",
            duration: 6000,
          });
          setIsCheckingBot(false);
          return;
        }

        setVerificationStatus({ isMember: true, hasPermissions: null });
        setVerificationProgress("🔑 Крок 3/4: Перевірка прав адміністратора...");
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const botId = selectedBot.bot_token.split(':')[0];
        const memberResponse = await fetch(
          `https://api.telegram.org/bot${selectedBot.bot_token}/getChatMember?chat_id=${channelIdentifier}&user_id=${botId}`
        );
        const memberData = await memberResponse.json();

        if (!memberData.ok || (memberData.result.status !== 'administrator' && memberData.result.status !== 'creator')) {
          setVerificationStatus({ isMember: true, hasPermissions: false });
          toast({
            title: "Недостатньо прав",
            description: "Бот доданий до каналу, але не має прав адміністратора. Надайте боту права адміністратора.",
            variant: "destructive",
            duration: 5000,
          });
          setIsCheckingBot(false);
          return;
        }

        setVerificationStatus({ isMember: true, hasPermissions: true });
        setVerificationProgress("Крок 4/4: Завершення налаштування...");
        await new Promise(resolve => setTimeout(resolve, 800));
        setVerificationProgress("Успішно підключено!");
        await new Promise(resolve => setTimeout(resolve, 600));

        setBotVerified(true);
        const channelTitle = checkData.result.title || channelIdentifier;
        toast({
          title: "Успішно!",
          description: `Бот підключений до приватного каналу "${channelTitle}"`,
          duration: 3000,
        });
      } else {
        // Handle as public channel with username
        setVerificationProgress("🌐 Крок 2/4: Перевірка публічного каналу...");
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // First check if it's a channel (not a group)
        const getChatResponse = await fetch(
          `https://api.telegram.org/bot${selectedBot.bot_token}/getChat?chat_id=@${channelIdentifier}`
        );
        const getChatData = await getChatResponse.json();
        
        if (getChatData.ok && getChatData.result.type !== 'channel') {
          toast({
            title: "Неправильний тип",
            description: `Це не канал, а ${getChatData.result.type === 'group' ? 'група' : getChatData.result.type === 'supergroup' ? 'супергрупа' : 'чат'}. Будь ласка, вкажіть посилання на канал (не групу/спільноту).`,
            variant: "destructive",
            duration: 5000,
          });
          setIsCheckingBot(false);
          return;
        }
        
        const { data, error } = await supabase.functions.invoke('check-bot-admin', {
          body: {
            botToken: selectedBot.bot_token,
            channelUsername: channelIdentifier,
          },
        });

        if (error) throw error;

        setVerificationStatus({
          isMember: data.isMember,
          hasPermissions: null,
        });
        setVerificationProgress("🔑 Крок 3/4: Перевірка прав адміністратора...");
        
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setVerificationStatus({
          isMember: data.isMember,
          hasPermissions: data.isAdmin,
        });

        if (data.isAdmin && data.isMember) {
          setVerificationProgress("Крок 4/4: Завершення налаштування...");
          await new Promise(resolve => setTimeout(resolve, 800));
          setVerificationProgress("Успішно підключено!");
          await new Promise(resolve => setTimeout(resolve, 600));
          
          setBotVerified(true);
          toast({
            title: "Успішно!",
            description: "Бот підключений до каналу і має всі необхідні права",
            duration: 2000,
          });
        } else {
          const errors = [];
          if (!data.isMember) errors.push("Бот не доданий до каналу");
          if (!data.isAdmin) errors.push("Бот не має прав адміністратора");
          
          toast({
            title: "Виправте помилки",
            description: errors.join(". "),
            variant: "destructive",
            duration: 3000,
          });
        }
      }
    } catch (error: any) {
      console.error("Error verifying bot:", error);
      setVerificationStatus({ isMember: false, hasPermissions: false });
      toast({
        title: "Помилка",
        description: "Не вдалося перевірити права бота",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsCheckingBot(false);
    }
  };

  const handleSaveBotService = async () => {
    if (!user || !selectedBotId || !botVerified) {
      toast({
        title: "Помилка",
        description: "Спочатку підтвердіть бота",
        variant: "destructive",
        duration: 1500,
      });
      return;
    }
    
    // Validate posts per day limit
    if (tariff && botService && botService.posts_per_day > tariff.posts_per_day) {
      toast({
        title: "Помилка",
        description: `Кількість постів на день не може перевищувати ${tariff.posts_per_day}`,
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    setIsSaving(true);
    try {
      // Check if target channel changed and if it's already taken
      if (botService && targetChannel !== botService.target_channel) {
        const { data: ownerCheck, error: ownerError } = await supabase
          .rpc('check_channel_ownership', { 
            channel_identifier: targetChannel,
            current_user_id: user.id 
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
          setIsSaving(false);
          return;
        }
      }
      
      const keywordsArray = keywords
        .split(",")
        .map(k => k.trim())
        .filter(k => k.length > 0);

      if (botService) {
        const { error } = await supabase
          .from("bot_services")
          .update({
            target_channel: targetChannel,
            posts_per_day: botService.posts_per_day,
            post_interval_minutes: botService.post_interval_minutes,
            include_media: botService.include_media,
            post_as_bot: botService.post_as_bot,
            keywords_filter: keywordsArray,
            publish_immediately: botService.publish_immediately,
            publish_old_posts: botService.publish_old_posts,
          })
          .eq("id", botService.id);

        if (error) throw error;
        
        // Reload bot service to get updated data
        await loadBotService(user.id, selectedBotId);
        setHasUnsavedChanges(false);
      } else {
        // Check if target channel is already taken before creating new service
        const { data: ownerCheck, error: ownerError } = await supabase
          .rpc('check_channel_ownership', { 
            channel_identifier: targetChannel,
            current_user_id: user.id 
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
          setIsSaving(false);
          return;
        }
        
        // Get active spy for statistics collection
        const { data: activeSpy } = await supabase
          .from('telegram_spies')
          .select('id')
          .eq('is_active', true)
          .eq('is_authorized', true)
          .limit(1)
          .maybeSingle();

        const { data, error } = await supabase
          .from("bot_services")
          .insert({
            user_id: user.id,
            bot_id: selectedBotId, // Link to the selected telegram bot
            target_channel: targetChannel,
            posts_per_day: tariff?.posts_per_day || 10,
            post_interval_minutes: 60,
            include_media: true,
            post_as_bot: true,
            keywords_filter: keywordsArray,
            is_running: false,
            publish_immediately: false,
            publish_old_posts: false,
            spy_id: activeSpy?.id || null,
          })
          .select()
          .single();
        
        if (activeSpy) {
          console.log('[Bot Setup] Attached spy for statistics:', activeSpy.id);
          
          // Try to join channel with spy for statistics collection
          try {
            const { error: joinError } = await supabase.functions.invoke('spy-join-channel', {
              body: { 
                spy_id: activeSpy.id, 
                channel_identifier: targetChannel 
              }
            });
            
            if (joinError) {
              console.log('[Bot Setup] Spy join warning:', joinError.message);
            } else {
              console.log('[Bot Setup] Spy joined target channel for statistics');
            }
          } catch (joinErr) {
            console.log('[Bot Setup] Non-critical: spy join failed (will still collect available stats)');
          }
        } else {
          console.log('[Bot Setup] No active spy available for statistics');
        }

        if (error) throw error;
        console.log("✅ Bot service created via save:", data);
        setBotService(data);
        
        // Додаємо всі pending джерела в БД
        if (pendingSourceChannels.length > 0) {
          const sourcesToInsert = pendingSourceChannels.map(ch => ({
            bot_service_id: data.id,
            channel_username: ch.username,
            channel_title: ch.title || null,
            is_private: ch.is_private || false,
            invite_hash: ch.invite_hash || null,
            spy_id: ch.spy_id || null,
            is_active: true,
          }));
          
          const { error: sourcesError } = await supabase
            .from("source_channels")
            .insert(sourcesToInsert);
          
          if (sourcesError) {
            console.error("Error adding sources:", sourcesError);
            toast({
              title: "Попередження",
              description: "Налаштування збережено, але деякі джерела не додались",
              variant: "destructive",
              duration: 3000,
            });
          } else {
            console.log(`✅ Added ${pendingSourceChannels.length} sources`);
            // Очищаємо pending список
            setPendingSourceChannels([]);
            // Завантажуємо джерела з БД
            await loadSourceChannels(data.id);
          }
        }
        
        setHasUnsavedChanges(false);
      }

      toast({
        title: "Збережено",
        description: "Налаштування бота успішно збережено",
        duration: 1500,
      });
    } catch (error: any) {
      console.error("Error saving bot service:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося зберегти налаштування",
        variant: "destructive",
        duration: 1500,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const updateBotServiceField = <K extends keyof BotService>(field: K, value: BotService[K]) => {
    setBotService(prev => prev ? { ...prev, [field]: value } : null);
    setHasUnsavedChanges(true);
  };

  const handleToggleBotStatus = async () => {
    console.log('🚀 handleToggleBotStatus called!');
    console.log('Bot service:', botService);
    
    if (!botService) {
      console.log('❌ No bot service');
      toast({
        title: "Помилка",
        description: "Спочатку збережіть налаштування бота",
        variant: "destructive",
        duration: 1500,
      });
      return;
    }

    if (sourceChannels.length === 0) {
      toast({
        title: "Помилка",
        description: "Додайте хоча б один канал-джерело",
        variant: "destructive",
        duration: 1500,
      });
      return;
    }

    try {
      const newStatus = !botService.is_running;
      const now = new Date().toISOString();
      
      console.log('⚙️ Toggling bot status to:', newStatus);
      console.log('📅 Started at will be:', now);
      
      const { error } = await supabase
        .from("bot_services")
        .update({ 
          is_running: newStatus,
          started_at: newStatus ? now : botService.started_at
        })
        .eq("id", botService.id);

      if (error) throw error;

      // Створюємо сповіщення через прямий INSERT
      if (user) {
        const selectedBot = bots.find(b => b.id === selectedBotId);
        const botName = selectedBot?.bot_name || 'Плагіатор';
        
        console.log('🔔 Creating bot notification for user:', user.id);
        console.log('🤖 Bot name:', botName, 'Channel:', botService.target_channel);
        
        // Перевіряємо налаштування
        const { data: settings } = await supabase
          .from('notification_settings')
          .select('bot_status_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        const isEnabled = settings?.bot_status_enabled ?? true;
        
        if (isEnabled) {
          if (newStatus) {
            // Бот запущено
            console.log('▶️ Creating bot_started notification via INSERT...');
            await supabase.from('notifications').insert({
              user_id: user.id,
              type: 'bot_started',
              title: 'Бот запущено',
              message: `Бот "${botName}" прив'язаний до каналу "${botService.target_channel}" розпочав свою роботу`,
              link: '/my-channels'
            });
            console.log('✅ Notification created');
          } else {
            // Бот зупинено
            console.log('⏸️ Creating bot_stopped notification via INSERT...');
            const runtimeHours = botService.started_at 
              ? (Date.now() - new Date(botService.started_at).getTime()) / (1000 * 60 * 60)
              : 0;
            console.log('⏱️ Runtime hours:', runtimeHours);
            
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
              message: `Бот "${botName}" прив'язаний до каналу "${botService.target_channel}" припинив свою роботу, пропрацювавши ${runtimeText}`,
              link: '/my-channels'
            });
            console.log('✅ Notification created');
          }
        }
      } else {
        console.warn('⚠️ User not found, cannot create notification');
      }

      setBotService({ ...botService, is_running: newStatus, started_at: newStatus ? now : botService.started_at });
      toast({
        title: newStatus ? "Бот запущено" : "Бот зупинено",
        description: newStatus 
          ? "Бот розпочав автоматичне копіювання постів" 
          : "Бот призупинив свою роботу",
        duration: 1500,
      });
    } catch (error: any) {
      console.error("Error toggling bot status:", error);
      
      // Створюємо сповіщення про помилку
      if (user && botService) {
        const selectedBot = bots.find(b => b.id === selectedBotId);
        const botName = selectedBot?.bot_name || 'Плагіатор';
        
        await supabase.rpc('create_bot_error_notification', {
          p_user_id: user.id,
          p_bot_name: botName,
          p_channel_name: botService.target_channel,
          p_error_message: error.message || 'Невідома помилка',
          p_service_type: 'plagiarist'
        });
      }
      
      toast({
        title: "Помилка",
        description: "Не вдалося змінити статус бота",
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const handleAddSourceChannel = async () => {
    // Allow adding sources before botService exists
    if (!selectedBotId || !botVerified) {
      toast({
        title: "Помилка",
        description: "Спочатку підключіть бота до каналу",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    if (!newChannelUsername.trim()) {
      toast({
        title: "Помилка",
        description: "Введіть @username, посилання або chat_id каналу",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    if (!user) {
      toast({
        title: "Помилка",
        description: "Користувач не знайдено",
        variant: "destructive",
        duration: 1500,
      });
      return;
    }

    const input = newChannelUsername.trim();
    
    // Normalize channel identifiers for comparison
    const normalizeChannelId = (channelId: string) => {
      return channelId
        .replace('@', '')
        .replace('https://', '')
        .replace('http://', '')
        .replace('t.me/', '')
        .replace('telegram.me/', '')
        .toLowerCase();
    };
    
    const normalizedInput = normalizeChannelId(input);
    const normalizedTarget = normalizeChannelId(targetChannel);
    
    // Check if source channel is same as target channel
    if (normalizedInput === normalizedTarget) {
      toast({
        title: "Помилка",
        description: "Канал-джерело не може співпадати з цільовим каналом. Виберіть інший канал.",
        variant: "destructive",
        duration: 3000,
      });
      return;
    }
    
    // Check for duplicate channels
    const isDuplicate = sourceChannels.some(channel => {
      const existingId = normalizeChannelId(channel.channel_username);
      return existingId === normalizedInput;
    });
    
    if (isDuplicate) {
      toast({
        title: "Помилка",
        description: "Цей канал вже додано до списку джерел",
        variant: "destructive",
        duration: 2000,
      });
      return;
    }

    // Check tariff limits
    if (tariff && tariff.sources_limit && sourceChannels.length >= tariff.sources_limit) {
      toast({
        title: "Досягнуто ліміту",
        description: `Ваш тариф дозволяє лише ${tariff.sources_limit} каналів-джерел. Оновіть тариф для додавання більше каналів.`,
        variant: "destructive",
        duration: 3000,
      });
      return;
    }

    const selectedBot = bots.find(b => b.id === selectedBotId);
    if (!selectedBot) {
      toast({
        title: "Помилка",
        description: "Бот не знайдено",
        variant: "destructive",
        duration: 1500,
      });
      return;
    }

    setIsCheckingChannel(true);
    setChannelVerificationStatus({ canRead: null, isPublic: null });

    try {
      // Якщо bot_service вже існує, перевіряємо чи джерело вже в БД
      if (botService) {
        // Перевірка на дублікат в БД
        const existsInDb = sourceChannels.some(ch => 
          normalizeChannelId(ch.channel_username) === normalizedInput
        );
        
        if (existsInDb) {
          toast({
            title: "Дублікат",
            description: "Цей канал вже додано до джерел",
            variant: "destructive",
            duration: 2000,
          });
          setIsCheckingChannel(false);
          return;
        }
      }
      
      // Перевірка на дублікат в локальних pending джерелах
      const existsInPending = pendingSourceChannels.some(ch => 
        normalizeChannelId(ch.username) === normalizedInput
      );
      
      if (existsInPending) {
        toast({
          title: "Дублікат",
          description: "Цей канал вже додано до списку",
          variant: "destructive",
          duration: 2000,
        });
        setIsCheckingChannel(false);
        return;
      }

      // Determine input type and extract channel identifier
      let channelId = input;
      let isPrivateInvite = false;
      let inviteHash = null;
      
      // Check if it's a chat_id (numeric)
      if (/^-?\d+$/.test(input)) {
        channelId = input;
      }
      // Check if it's an invite link (private channel)
      else if (input.includes('t.me/+') || input.includes('t.me/joinchat/') || input.includes('telegram.me/+')) {
        isPrivateInvite = true;
        const inviteMatch = input.match(/(?:https?:\/\/)?(?:t\.me|telegram\.me)\/(?:\+|joinchat\/)([A-Za-z0-9_-]+)/);
        if (inviteMatch) {
          inviteHash = inviteMatch[1];
          channelId = `invite_${inviteHash}`; // Тимчасовий ID для збереження
        } else {
          toast({
            title: "Помилка",
            description: "Невірний формат invite-посилання",
            variant: "destructive",
            duration: 3000,
          });
          setIsCheckingChannel(false);
          return;
        }
      }
      // Regular public channel link
      else if (input.includes('t.me/') || input.includes('telegram.me/')) {
        const match = input.match(/(?:t\.me|telegram\.me)\/([^/?]+)/);
        if (match) {
          channelId = `@${match[1].replace('@', '')}`;
        }
      }
      // Username with @
      else if (input.startsWith('@')) {
        channelId = input;
      }
      // Plain username
      else {
        channelId = `@${input}`;
      }
      
      // Для приватних invite-посилань використовуємо verify-source-channel
      if (isPrivateInvite) {
        setChannelVerificationStatus({ canRead: null, isPublic: false });
        
        try {
          // Викликаємо Edge Function для верифікації через спамера
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke('verify-source-channel', {
            body: {
              channel_input: input, // Edge Function очікує channel_input
              is_private: true,
              invite_hash: inviteHash,
            }
          });

          if (verifyError) throw new Error(verifyError.message);
          if (!verifyData.success) throw new Error(verifyData.error);

          // Отримуємо реальну інформацію про канал
          const channelInfo = verifyData.channelInfo;
          const shortHash = inviteHash?.substring(0, 8) || 'unknown';
          let channelTitle = `🔒 Приватний канал (${shortHash}...)`;
          let photoUrl: string | undefined = undefined;
          
          // Якщо Edge Function повернула реальні дані
          if (channelInfo && channelInfo.title && channelInfo.title !== '🔒 Приватний канал') {
            channelTitle = channelInfo.title;
          }
          
          // Отримуємо реальну інформацію через read-private-channel
          if (channelInfo && channelInfo.spammerId) {
            toast({
              title: "Підключаюсь до каналу...",
              description: "Отримую інформацію через спамера",
              duration: 2000,
            });
            
            try {
              const { data: readData, error: readError } = await supabase.functions.invoke('read-private-channel', {
                body: {
                  spammerId: channelInfo.spammerId,
                  channelIdentifier: channelId,
                  inviteHash: inviteHash,
                  limit: 10, // Отримуємо останні 10 постів
                }
              });
              
              if (!readError && readData?.success) {
                // Отримали реальну інформацію про канал
                if (readData.channelInfo) {
                  channelTitle = readData.channelInfo.title || channelTitle;
                  photoUrl = readData.channelInfo.photo || readData.channelInfo.photo_url;
                  console.log("Got channel info:", readData.channelInfo);
                }
                
                // Якщо є пости, збережемо їх після створення bot_service
                if (readData.messages && readData.messages.length > 0) {
                  console.log(`Got ${readData.messages.length} messages from channel`);
                }
              }
            } catch (err) {
              console.log("Could not read private channel:", err);
              // Не критична помилка - канал все одно буде додано
            }
          }
          
          setChannelVerificationStatus({ canRead: true, isPublic: false });
          
          toast({
            title: "Приватний канал додано",
            description: `Спамер отримає доступ до каналу при першій синхронізації`,
            duration: 3000,
          });
          
          if (botService) {
            // Додаємо канал в БД
            const { data: newChannel, error } = await supabase
              .from("source_channels")
              .insert({
                bot_service_id: botService.id,
                channel_username: channelId,
                is_active: true,
                is_private: true,
                invite_hash: inviteHash,
                spammer_id: channelInfo.spammerId || null,
              })
              .select()
              .single();

            if (error) throw error;
            
            // Викликаємо першу синхронізацію для отримання реальної назви та постів
            toast({
              title: "Синхронізація...",
              description: "Отримую інформацію про канал через спамера",
              duration: 2000,
            });
            
            try {
              const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-source-posts', {
                body: {
                  sourceChannelId: newChannel.id,
                  channelIdentifier: channelId,
                  isPrivate: true,
                  inviteHash: inviteHash,
                }
              });
              
              if (syncError) {
                console.error("Sync error:", syncError);
                toast({
                  title: "Попередження",
                  description: "Канал додано, але синхронізація відкладена",
                  variant: "default",
                  duration: 3000,
                });
              } else if (syncData?.success) {
                toast({
                  title: "Синхронізація завершена",
                  description: `Отримано інформацію про канал`,
                  duration: 2000,
                });
              }
            } catch (syncErr) {
              console.error("Failed to trigger sync:", syncErr);
            }
            
            await loadSourceChannels(botService.id);
          } else {
            setPendingSourceChannels(prev => [...prev, { 
              username: channelId,
              title: channelTitle,
              photo_url: photoUrl,
              is_private: true,
              invite_hash: inviteHash,
              spy_id: verifyData.channelInfo?.spyId || null
            }]);
          }
          
          setNewChannelUsername("");
          setChannelVerificationStatus({ canRead: null, isPublic: null });
          setIsCheckingChannel(false);
          return;
          
        } catch (error: any) {
          console.error("Error verifying private channel:", error);
          toast({
            title: "Помилка перевірки",
            description: error.message || "Не вдалося перевірити приватний канал. Перевірте налаштування спамера в адмінці.",
            variant: "destructive",
            duration: 5000,
          });
          setChannelVerificationStatus({ canRead: null, isPublic: null });
          setIsCheckingChannel(false);
          return;
        }
      }

      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Try to get chat info
      const checkResponse = await fetch(
        `https://api.telegram.org/bot${selectedBot.bot_token}/getChat?chat_id=${channelId}`
      );
      const checkData = await checkResponse.json();

      if (!checkData.ok) {
        setChannelVerificationStatus({ canRead: false, isPublic: false });
        const isPrivate = channelId.includes('+') || channelId.includes('joinchat');
        const errorMsg = isPrivate 
          ? "Бот не має доступу до приватного каналу. Переконайтеся, що бот доданий як учасник каналу."
          : "Канал не знайдено або недоступний. Перевірте правильність введених даних.";
        toast({
          title: "Помилка доступу",
          description: errorMsg,
          variant: "destructive",
          duration: 5000,
        });
        setIsCheckingChannel(false);
        return;
      }

      // For private channels, check if bot is a member
      // For public channels, bot doesn't need to be a member to read posts
      const isPrivate = channelId.includes('+') || channelId.includes('joinchat');
      if (isPrivate) {
        setChannelVerificationStatus({ canRead: true, isPublic: null });
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const botId = selectedBot.bot_token.split(':')[0];
        const memberResponse = await fetch(
          `https://api.telegram.org/bot${selectedBot.bot_token}/getChatMember?chat_id=${channelId}&user_id=${botId}`
        );
        const memberData = await memberResponse.json();

        if (!memberData.ok || memberData.result.status === 'left' || memberData.result.status === 'kicked') {
          setChannelVerificationStatus({ canRead: true, isPublic: false });
          toast({
            title: "Бот не є учасником",
            description: "Для приватного каналу бот повинен бути доданий як учасник для читання постів.",
            variant: "destructive",
            duration: 5000,
          });
          setIsCheckingChannel(false);
          return;
        }
      }

      setChannelVerificationStatus({ canRead: true, isPublic: true });
      await new Promise(resolve => setTimeout(resolve, 500));

      // Додаємо канал локально (не в БД)
      const channelTitle = checkData.result.title || channelId;
      
      // Отримуємо URL аватарки
      let photoUrl: string | undefined = undefined;
      if (checkData.result.photo?.small_file_id) {
        try {
          const fileResponse = await fetch(
            `https://api.telegram.org/bot${selectedBot.bot_token}/getFile?file_id=${checkData.result.photo.small_file_id}`
          );
          const fileData = await fileResponse.json();
          if (fileData.ok && fileData.result.file_path) {
            photoUrl = `https://api.telegram.org/file/bot${selectedBot.bot_token}/${fileData.result.file_path}`;
          }
        } catch (error) {
          console.log("Could not fetch photo:", error);
        }
      }
      
      if (botService) {
        // Якщо bot_service вже існує, додаємо в БД
        const { error } = await supabase
          .from("source_channels")
          .insert({
            bot_service_id: botService.id,
            channel_username: channelId,
            is_active: true,
          });

        if (error) throw error;
        
        await loadSourceChannels(botService.id);
      } else {
        // Додаємо в локальний список (до збереження)
        setPendingSourceChannels(prev => [...prev, { 
          username: channelId, 
          title: channelTitle,
          photo_url: photoUrl 
        }]);
      }

      setNewChannelUsername("");
      setChannelVerificationStatus({ canRead: null, isPublic: null });
      
      toast({
        title: "✅ Джерельний канал успішно додано!",
        description: channelTitle,
        duration: 3000,
      });
    } catch (error: any) {
      console.error("Error adding source channel:", error);
      setChannelVerificationStatus({ canRead: false, isPublic: false });
      toast({
        title: "Помилка",
        description: error.message || "Не вдалося додати канал",
        variant: "destructive",
        duration: 3000,
      });
    } finally {
      setIsCheckingChannel(false);
    }
  };

  const handleDeleteSourceChannel = async (channelId: string) => {
    try {
      const { error } = await supabase
        .from("source_channels")
        .delete()
        .eq("id", channelId);

      if (error) throw error;

      setSourceChannels(sourceChannels.filter(ch => ch.id !== channelId));
      
      toast({
        title: "Канал видалено",
        description: "Канал-джерело успішно видалено",
        duration: 1500,
      });
    } catch (error: any) {
      console.error("Error deleting source channel:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося видалити канал",
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  const handleDeletePendingChannel = (username: string) => {
    setPendingSourceChannels(prev => prev.filter(ch => ch.username !== username));
    toast({
      title: "Канал видалено",
      description: "Канал видалено зі списку",
      duration: 1500,
    });
  };

  const handleToggleChannelStatus = async (channelId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from("source_channels")
        .update({ is_active: !currentStatus })
        .eq("id", channelId);

      if (error) throw error;

      setSourceChannels(sourceChannels.map(ch => 
        ch.id === channelId ? { ...ch, is_active: !currentStatus } : ch
      ));
    } catch (error: any) {
      console.error("Error toggling channel status:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося змінити статус каналу",
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  if (!selectedBotId) {
    return (
      <div className="min-h-screen">
        <PageBreadcrumbs />
        <div className="container mx-auto px-4 py-8">
          <PageHeader
            icon={Bot}
            title="Мої боти"
            description="Оберіть бота для налаштування або створіть новий бот для автоматизації публікацій"
            backTo="/dashboard"
            backLabel="Назад до панелі"
          />
          <BotCategoriesPanel bots={bots} selectedBotId={selectedBotId} onSelectBot={handleSelectBot} />
        </div>
      </div>
    );
  }

  // Check if selected bot is AI bot
  const selectedBot = bots.find(b => b.id === selectedBotId);
  const isAIBot = selectedBot?.bot_type === 'ai';

  // For AI bots, show AI setup interface
  if (isAIBot && user) {
    return (
      <div className="min-h-screen">
        <PageBreadcrumbs />
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <PageHeader
            icon={Zap}
            title={`Налаштування AI бота ${selectedBot.bot_name || ''}`}
            description="Налаштуйте автоматичну генерацію контенту за допомогою штучного інтелекту"
            backTo="/my-channels"
            backLabel="Повернутись до каналів"
          />
          <AIBotSetup 
            botId={selectedBotId} 
            botUsername={selectedBot.bot_username || ""}
            botToken={selectedBot.bot_token}
            userId={user.id}
            serviceId={location.state?.aiServiceId}
          />
        </div>
      </div>
    );
  }

  if (!botVerified) {
    return (
      <>
        {isCheckingBot && (
          <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center">
            <Card className="w-[90%] max-w-md border-2 shadow-2xl">
              <div className="p-6">
                <div className="flex flex-col items-center space-y-6">
                  <div className="relative">
                    <div className="w-24 h-24 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                    <Bot className="w-12 h-12 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
                  </div>
                  
                  <div className="text-center space-y-2">
                    <h3 className="text-xl font-semibold">Перевірка бота...</h3>
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
        <div className="min-h-screen">
          <PageBreadcrumbs />
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <PageHeader
            icon={Bot}
            title="Підключення бота"
            description="Додайте бота до цільового каналу та надайте необхідні права для публікації"
          >
            <Button 
              variant="ghost" 
              onClick={() => setSelectedBotId(null)} 
              className="mt-4"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Обрати іншого бота
            </Button>
          </PageHeader>
          <Card className="p-8">
            <div className="space-y-6">
              <div className="text-center">
                <h3 className="text-xl font-bold mb-2">Крок 1: Додайте бота до каналу</h3>
                <p className="text-muted-foreground">
                  Додайте бота до свого каналу та надайте йому права адміністратора
                </p>
              </div>
              <Alert>
                <AlertDescription>
                  <ol className="list-decimal list-inside space-y-3">
                    <li>
                      Додайте бота{" "}
                      <a 
                        href={`https://t.me/${bots.find(b => b.id === selectedBotId)?.bot_username}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-primary hover:underline"
                      >
                        @{bots.find(b => b.id === selectedBotId)?.bot_username}
                      </a>
                      {" "}до вашого каналу
                    </li>
                    <li>
                      Надайте боту права адміністратора з наступними дозволами:
                      <ul className="list-disc list-inside ml-4 mt-1 text-sm">
                        <li>Публікувати повідомлення</li>
                        <li>Редагувати повідомлення</li>
                        <li>Видаляти повідомлення (опціонально)</li>
                      </ul>
                    </li>
                    <li>
                      <strong>Важливо:</strong> Якщо хочете, щоб пости публікувалися від імені каналу (а не від імені бота), зробіть бота <strong>анонімним адміністратором</strong>
                    </li>
                    <li>Вкажіть username вашого каналу нижче</li>
                    <li>Натисніть "Перевірити підключення"</li>
                  </ol>
                </AlertDescription>
              </Alert>
              
              <div className="rounded-lg overflow-hidden border">
                <img 
                  src={addBotInstruction} 
                  alt="Інструкція як додати бота до каналу" 
                  className="w-full h-auto"
                />
              </div>

              <Alert className="bg-blue-500/10 border-blue-500/20">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0" />
                <AlertDescription>
                  <div className="text-sm space-y-2">
                    <p className="font-semibold text-blue-700 dark:text-blue-300">Як підключити канал:</p>
                    <div className="space-y-1 text-blue-600 dark:text-blue-400">
                      <p className="break-words"><strong>Публічний канал:</strong> введіть @username або https://t.me/username</p>
                      <p className="break-words"><strong>Приватний канал:</strong> введіть invite-посилання https://t.me/+xxx (userbot приєднається автоматично та передасть дані боту)</p>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
              
              <div className="space-y-2">

                  </div>
                <Input
                  id="targetChannel"
                  placeholder="@channel, https://t.me/channel або https://t.me/+invite"
                  value={targetChannel}
                  onChange={(e) => setTargetChannel(e.target.value)}
                />
              </div>
              
              {/* Verification Progress */}
              {(isCheckingBot || verificationStatus.isMember !== null) && (
                <Card className="p-4 bg-muted/30">
                  <h3 className="font-semibold mb-3">Прогрес перевірки:</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {isCheckingBot && verificationStatus.isMember === null ? (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      ) : verificationStatus.isMember === true ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : verificationStatus.isMember === false ? (
                        <span className="w-5 h-5 text-red-500 flex items-center justify-center font-bold">✕</span>
                      ) : null}
                      <span className={verificationStatus.isMember === true ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                        Бот доданий в канал
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {isCheckingBot && verificationStatus.hasPermissions === null ? (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      ) : verificationStatus.hasPermissions === true ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : verificationStatus.hasPermissions === false ? (
                        <span className="w-5 h-5 text-red-500 flex items-center justify-center font-bold">✕</span>
                      ) : null}
                      <span className={verificationStatus.hasPermissions === true ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                        Бот має права адміністратора
                      </span>
                    </div>
                  </div>
                  
                  {!isCheckingBot && verificationStatus.isMember !== null && (
                    verificationStatus.isMember && verificationStatus.hasPermissions ? (
                      <Alert className="mt-3 bg-green-500/10 border-green-500/20">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <AlertDescription>
                          <div className="text-green-600 dark:text-green-400">
                            Всі перевірки пройдено успішно! Бот готовий до роботи.
                          </div>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="mt-3 bg-red-500/10 border-red-500/20">
                        <Info className="w-4 h-4 text-red-500" />
                        <AlertDescription>
                          <div className="text-red-600 dark:text-red-400 font-semibold">
                            Виявлено помилки. Будь ласка, виправте їх та спробуйте знову.
                          </div>
                        </AlertDescription>
                      </Alert>
                    )
                  )}
                </Card>
              )}
              
              <Button onClick={handleVerifyBot} disabled={isCheckingBot || !targetChannel} className="w-full h-12 text-base">
                {isCheckingBot ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Перевірка...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 mr-2" />
                    Перевірити підключення
                  </>
                )}
              </Button>
            </div>
          </Card>
        </div>
      </>
    );
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-8">
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4">
              <h2 className="text-xl font-bold mb-1">Канали-джерела</h2>
              <p className="text-sm text-muted-foreground">
                Канали, з яких бот копіює контент для публікації
                {tariff && (
                  <span className="ml-1">
                    ({sourceChannels.length} з {tariff.sources_limit || '∞'})
                  </span>
                )}
              </p>
            </div>
            
            <div className="space-y-4 mb-4">
              {/* Instructions */}
              <Alert className="bg-blue-500/10 border-blue-500/20">
                <AlertDescription>
                  <div className="text-sm space-y-2">
                    <p className="font-medium mb-1.5">📋 Підтримувані формати:</p>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex gap-2">
                        <span className="text-green-500">✓</span>
                        <span><strong>Публічні:</strong> @channel, t.me/channel, https://t.me/channel</span>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-blue-500">✓</span>
                        <span><strong>Приватні:</strong> t.me/+AbCdEf123, https://t.me/+AbCdEf123 (invite-посилання)</span>
                      </div>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>

              {/* Input Field */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Label htmlFor="sourceChannel">Username або посилання</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button type="button" className="inline-flex items-center justify-center rounded-full w-5 h-5 bg-muted hover:bg-muted/80 transition-colors">
                        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 z-[100]" side="top" align="start">
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <p className="font-semibold text-sm">Приватний канал</p>
                          <p className="text-xs text-muted-foreground">
                            Для читання постів боту <strong>НЕ потрібні</strong> права адміністратора!
                          </p>
                        </div>
                        
                        <div className="space-y-2 text-xs">
                          <div className="bg-muted/50 p-3 rounded-md space-y-2">
                            <p className="font-medium">Як підключити:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-2 text-muted-foreground">
                              <li>Додайте бота в приватний канал як звичайного учасника</li>
                              <li>Отримайте числовий chat_id каналу</li>
                              <li>Вкажіть chat_id нижче (формат: -1001234567890)</li>
                            </ol>
                          </div>
                          
                          <div className="bg-muted/50 p-3 rounded-md space-y-2">
                            <p className="font-medium">Як отримати chat_id:</p>
                            <ol className="list-decimal list-inside space-y-1 ml-2 text-muted-foreground">
                              <li>Додайте @userinfobot або @JsonDumpBot у Telegram</li>
                              <li>Перешліть повідомлення з приватного каналу в бота</li>
                              <li>Бот покаже вам chat_id каналу</li>
                            </ol>
                            
                            <div className="flex flex-col sm:flex-row gap-2 pt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  window.open('https://t.me/userinfobot', '_blank');
                                  toast({
                                    title: "Відкрито @userinfobot",
                                    description: "Натисніть /start в боті",
                                    duration: 3000,
                                  });
                                }}
                                className="text-xs h-7"
                              >
                                Відкрити @userinfobot
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  window.open('https://t.me/JsonDumpBot', '_blank');
                                  toast({
                                    title: "Відкрито @JsonDumpBot",
                                    description: "Натисніть /start в боті",
                                    duration: 3000,
                                  });
                                }}
                                className="text-xs h-7"
                              >
                                Відкрити @JsonDumpBot
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex gap-2">
                  <Input
                    id="sourceChannel"
                    placeholder="@channel, t.me/channel або t.me/+invite"
                    value={newChannelUsername}
                    onChange={(e) => setNewChannelUsername(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && !isCheckingChannel && newChannelUsername.trim() && handleAddSourceChannel()}
                    disabled={isCheckingChannel || (tariff !== null && tariff.sources_limit !== null && sourceChannels.length >= tariff.sources_limit)}
                  />
                  <Button 
                    onClick={handleAddSourceChannel}
                    disabled={
                      isCheckingChannel || 
                      !newChannelUsername.trim() ||
                      (tariff !== null && tariff.sources_limit !== null && sourceChannels.length >= tariff.sources_limit)
                    }
                  >
                    {isCheckingChannel ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Перевіряю...
                      </>
                    ) : (
                      <>
                        <Plus className="w-4 h-4 mr-2" />
                        Додати джерело
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Channel Verification Progress */}
              {(isCheckingChannel || channelVerificationStatus.canRead !== null) && (
                <Card className="p-4 bg-muted/30">
                  <h3 className="font-semibold mb-3">Перевірка каналу:</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      {isCheckingChannel && channelVerificationStatus.canRead === null ? (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      ) : channelVerificationStatus.canRead === true ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : channelVerificationStatus.canRead === false ? (
                        <span className="w-5 h-5 text-red-500 flex items-center justify-center font-bold">✕</span>
                      ) : null}
                      <span className={channelVerificationStatus.canRead === true ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                        Канал доступний
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-3">
                      {isCheckingChannel && channelVerificationStatus.isPublic === null ? (
                        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                      ) : channelVerificationStatus.isPublic === true ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : channelVerificationStatus.isPublic === false ? (
                        <span className="w-5 h-5 text-red-500 flex items-center justify-center font-bold">✕</span>
                      ) : null}
                      <span className={channelVerificationStatus.isPublic === true ? "text-green-600 dark:text-green-400 font-medium" : ""}>
                        Бот є учасником каналу
                      </span>
                    </div>
                  </div>
                  
                  {!isCheckingChannel && channelVerificationStatus.canRead !== null && (
                    channelVerificationStatus.canRead && channelVerificationStatus.isPublic ? (
                      <Alert className="mt-3 bg-green-500/10 border-green-500/20">
                        <CheckCircle2 className="w-4 h-4 text-green-500" />
                        <AlertDescription>
                          <div className="text-green-600 dark:text-green-400">
                            Канал успішно перевірено і додано!
                          </div>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <Alert className="mt-3 bg-red-500/10 border-red-500/20">
                        <Info className="w-4 h-4 text-red-500" />
                        <AlertDescription>
                          <div className="text-red-600 dark:text-red-400 font-semibold">
                            Не вдалося додати канал. Перевірте доступність.
                          </div>
                        </AlertDescription>
                      </Alert>
                    )
                  )}
                </Card>
              )}
            </div>
            
            {tariff && tariff.sources_limit && sourceChannels.length >= tariff.sources_limit && (
              <Alert className="mb-4 bg-orange-500/10 border-orange-500/20">
                <Info className="w-4 h-4 text-orange-500" />
                <AlertDescription>
                  <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                    Ви досягли ліміту джерел ({tariff.sources_limit}). Не можна додати більше джерел. Оновіть тариф або видаліть існуюче джерело.
                  </div>
                </AlertDescription>
              </Alert>
            )}
            <Separator className="my-4" />
            <div className="space-y-3">
              {/* Pending джерела (локальні, не збережені) */}
              {pendingSourceChannels.map((channel, index) => (
                <Card key={`pending-${index}`} className="p-4 bg-muted/30 border-dashed">
                  <div className="flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {channel.photo_url ? (
                        <img 
                          src={channel.photo_url} 
                          alt={channel.title || channel.username}
                          className="w-12 h-12 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-lg font-semibold text-primary">
                            {(channel.title || channel.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{channel.title || channel.username}</div>
                      <div className="text-sm text-muted-foreground truncate">{channel.username}</div>
                      <div className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Очікує збереження</div>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleDeletePendingChannel(channel.username)}
                      className="text-destructive hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4 mr-1" />
                      Видалити
                    </Button>
                  </div>
                </Card>
              ))}

              {/* Збережені джерела (з БД) */}
              {sourceChannels.map((channel) => (
                <Card key={channel.id} className="p-4 bg-background border-border">
                  <div className="flex flex-col gap-3">
                    <div className="flex-1 min-w-0">
                      {selectedBotId && bots.find(b => b.id === selectedBotId)?.bot_token ? (
                        <ChannelInfo 
                          channelUsername={channel.channel_username} 
                          botToken={bots.find(b => b.id === selectedBotId)!.bot_token}
                          compact={true}
                        />
                      ) : (
                        <div className="flex-1">
                          <div className="font-medium">{channel.channel_username}</div>
                          <div className="text-sm text-muted-foreground">Канал-джерело</div>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 pt-2 border-t">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">
                            {channel.is_active ? "Активний" : "Неактивний"}
                          </span>
                          <Switch 
                            checked={channel.is_active} 
                            onCheckedChange={() => handleToggleChannelStatus(channel.id, channel.is_active)} 
                          />
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          onClick={() => handleDeleteSourceChannel(channel.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Видалити
                        </Button>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`px-2 py-1 rounded-full font-medium ${
                          channel.is_private 
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' 
                            : 'bg-green-500/10 text-green-600 dark:text-green-400'
                        }`}>
                          {channel.is_private ? '🔒 Приватний' : '🌐 Публічний'}
                        </span>
                        {channel.spy_id && (
                          <span className="px-2 py-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 font-medium">
                            👁️ Userbot
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
              {sourceChannels.length === 0 && pendingSourceChannels.length === 0 && (
                <div className="text-center py-12">
                  <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground">Поки що немає джерел</p>
                  <p className="text-sm text-muted-foreground mt-1">Додайте канал-джерело вище, щоб почати копіювання контенту</p>
                </div>
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-xl font-bold mb-4">Основні налаштування</h2>
            <div className="space-y-6">
              {/* Channel Info */}
              <div className="space-y-2">
                <Label>Цільовий канал</Label>
                {targetChannel && bots.find(b => b.id === selectedBotId)?.bot_token && (
                  <ChannelInfo 
                    channelUsername={targetChannel} 
                    botToken={bots.find(b => b.id === selectedBotId)!.bot_token}
                  />
                )}
              </div>

              <Separator />

              {/* Filters Section */}
              <Collapsible open={showFilters} onOpenChange={setShowFilters}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline" className="w-full justify-between">
                    <span className="text-lg font-semibold">Налаштування фільтрів</span>
                    {showFilters ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                
                <CollapsibleContent className="space-y-4 mt-4">
                  <p className="text-sm text-muted-foreground">
                    Доступність фільтрів залежить від вашого тарифу
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Копіювання медіа */}
                    <div className={`flex items-center justify-between p-4 border rounded-lg ${
                      tariff?.allow_media ? '' : 'opacity-50 bg-muted/50'
                    }`}>
                      <div className="flex-1">
                        <Label htmlFor="include_media" className="cursor-pointer font-medium">
                          Копіювання медіа
                        </Label>
                        <p className="text-xs text-muted-foreground">Зображення та відео</p>
                        {!tariff?.allow_media && (
                          <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                        )}
                      </div>
                      <Switch
                        id="include_media"
                        checked={botService?.include_media ?? true}
                        onCheckedChange={(checked) => updateBotServiceField('include_media', checked)}
                        disabled={!tariff?.allow_media}
                      />
                    </div>

                    {/* Тільки нові пости */}
                    <div className={`flex items-center justify-between p-4 border rounded-lg ${
                      tariff?.allow_new_posts_only ? '' : 'opacity-50 bg-muted/50'
                    }`}>
                      <div className="flex-1">
                        <Label htmlFor="publish_old_posts" className="cursor-pointer font-medium">
                          Тільки нові пости
                        </Label>
                        <p className="text-xs text-muted-foreground">Без старих постів</p>
                        {!tariff?.allow_new_posts_only && (
                          <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                        )}
                      </div>
                      <Switch
                        id="publish_old_posts"
                        checked={!(botService?.publish_old_posts ?? false)}
                        onCheckedChange={(checked) => updateBotServiceField('publish_old_posts', !checked)}
                        disabled={!tariff?.allow_new_posts_only}
                      />
                    </div>

                    {/* Фільтр ключових слів */}
                    <div className={`flex items-center justify-between p-4 border rounded-lg ${
                      tariff?.allow_keyword_filter ? '' : 'opacity-50 bg-muted/50'
                    }`}>
                      <div className="flex-1">
                        <Label htmlFor="use_keyword_filter" className="cursor-pointer font-medium">
                          Фільтр ключових слів
                        </Label>
                        <p className="text-xs text-muted-foreground">Пошук по словам</p>
                        {!tariff?.allow_keyword_filter && (
                          <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                        )}
                      </div>
                      <Switch
                        id="use_keyword_filter"
                        checked={useKeywordFilter}
                        onCheckedChange={setUseKeywordFilter}
                        disabled={!tariff?.allow_keyword_filter}
                      />
                    </div>

                    {/* Відкладена публікація */}
                    <div className={`flex items-center justify-between p-4 border rounded-lg ${
                      tariff?.allow_scheduled_posting ? '' : 'opacity-50 bg-muted/50'
                    }`}>
                      <div className="flex-1">
                        <Label htmlFor="publish_immediately" className="cursor-pointer font-medium">
                          Відкладена публікація
                        </Label>
                        <p className="text-xs text-muted-foreground">Інтервал між постами</p>
                        {!tariff?.allow_scheduled_posting && (
                          <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                        )}
                      </div>
                      <Switch
                        id="publish_immediately"
                        checked={!(botService?.publish_immediately ?? false)}
                        onCheckedChange={(checked) => updateBotServiceField('publish_immediately', !checked)}
                        disabled={!tariff?.allow_scheduled_posting}
                      />
                    </div>

                    {/* Публікація від каналу */}
                    <div className={`flex items-center justify-between p-4 border rounded-lg ${
                      tariff?.allow_post_as_channel ? '' : 'opacity-50 bg-muted/50'
                    }`}>
                      <div className="flex-1">
                        <Label htmlFor="post_as_bot" className="cursor-pointer font-medium">
                          Публікація від каналу
                        </Label>
                        <p className="text-xs text-muted-foreground">Без підпису бота</p>
                        {!tariff?.allow_post_as_channel && (
                          <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                        )}
                      </div>
                      <Switch
                        id="post_as_bot"
                        checked={!(botService?.post_as_bot ?? true)}
                        onCheckedChange={(checked) => updateBotServiceField('post_as_bot', !checked)}
                        disabled={!tariff?.allow_post_as_channel}
                      />
                    </div>

                    {/* Авто-видалення */}
                    <div className={`flex items-center justify-between p-4 border rounded-lg ${
                      tariff?.allow_auto_delete ? '' : 'opacity-50 bg-muted/50'
                    }`}>
                      <div className="flex-1">
                        <Label htmlFor="allow_auto_delete" className="cursor-pointer font-medium">
                          Авто-видалення
                        </Label>
                        <p className="text-xs text-muted-foreground">Видалення через час</p>
                        {!tariff?.allow_auto_delete && (
                          <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                        )}
                      </div>
                      <Switch
                        id="allow_auto_delete"
                        checked={botService?.allow_auto_delete ?? false}
                        onCheckedChange={(checked) => updateBotServiceField('allow_auto_delete', checked)}
                        disabled={!tariff?.allow_auto_delete}
                      />
                    </div>

                    {/* Водяний знак */}
                    <div className={`flex items-center justify-between p-4 border rounded-lg ${
                      tariff?.allow_custom_watermark ? '' : 'opacity-50 bg-muted/50'
                    }`}>
                      <div className="flex-1">
                        <Label htmlFor="allow_custom_watermark" className="cursor-pointer font-medium">
                          Водяний знак
                        </Label>
                        <p className="text-xs text-muted-foreground">Додавання логотипу</p>
                        {!tariff?.allow_custom_watermark && (
                          <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                        )}
                      </div>
                      <Switch
                        id="allow_custom_watermark"
                        checked={botService?.allow_custom_watermark ?? false}
                        onCheckedChange={(checked) => updateBotServiceField('allow_custom_watermark', checked)}
                        disabled={!tariff?.allow_custom_watermark}
                      />
                    </div>

                    {/* Попередній перегляд */}
                    <div className={`flex items-center justify-between p-4 border rounded-lg ${
                      tariff?.allow_link_preview ? '' : 'opacity-50 bg-muted/50'
                    }`}>
                      <div className="flex-1">
                        <Label htmlFor="allow_link_preview" className="cursor-pointer font-medium">
                          Попередній перегляд
                        </Label>
                        <p className="text-xs text-muted-foreground">Превью посилань</p>
                        {!tariff?.allow_link_preview && (
                          <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                        )}
                      </div>
                      <Switch
                        id="allow_link_preview"
                        checked={botService?.allow_link_preview ?? true}
                        onCheckedChange={(checked) => updateBotServiceField('allow_link_preview', checked)}
                        disabled={!tariff?.allow_link_preview}
                      />
                    </div>

                    {/* Мітка пересилання */}
                    <div className={`flex items-center justify-between p-4 border rounded-lg ${
                      tariff?.allow_forward_tag ? '' : 'opacity-50 bg-muted/50'
                    }`}>
                      <div className="flex-1">
                        <Label htmlFor="allow_forward_tag" className="cursor-pointer font-medium">
                          Мітка пересилання
                        </Label>
                        <p className="text-xs text-muted-foreground">Збереження форварду</p>
                        {!tariff?.allow_forward_tag && (
                          <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                        )}
                      </div>
                      <Switch
                        id="allow_forward_tag"
                        checked={botService?.allow_forward_tag ?? false}
                        onCheckedChange={(checked) => updateBotServiceField('allow_forward_tag', checked)}
                        disabled={!tariff?.allow_forward_tag}
                      />
                    </div>

                    {/* Редагування постів */}
                    <div className={`flex items-center justify-between p-4 border rounded-lg ${
                      tariff?.allow_edit_before_post ? '' : 'opacity-50 bg-muted/50'
                    }`}>
                      <div className="flex-1">
                        <Label htmlFor="allow_edit_before_post" className="cursor-pointer font-medium">
                          Редагування постів
                        </Label>
                        <p className="text-xs text-muted-foreground">Перед публікацією</p>
                        {!tariff?.allow_edit_before_post && (
                          <p className="text-xs text-destructive mt-1">Недоступно в тарифі</p>
                        )}
                      </div>
                      <Switch
                        id="allow_edit_before_post"
                        checked={botService?.allow_edit_before_post ?? false}
                        onCheckedChange={(checked) => updateBotServiceField('allow_edit_before_post', checked)}
                        disabled={!tariff?.allow_edit_before_post}
                      />
                    </div>
                  </div>

                {/* Keyword Filter Input */}
                  {useKeywordFilter && tariff?.allow_keyword_filter && (
                    <div className="space-y-2 p-4 border rounded-lg bg-muted/30">
                      <Label htmlFor="keywords">Ключові слова (через кому)</Label>
                      <Textarea
                        id="keywords"
                        value={keywords}
                        onChange={(e) => {
                          setKeywords(e.target.value);
                          setHasUnsavedChanges(true);
                        }}
                        placeholder="слово1, слово2, слово3"
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        Бот буде копіювати тільки пости, що містять хоча б одне із цих слів
                      </p>
                    </div>
                  )}
                </CollapsibleContent>
              </Collapsible>

              <Separator />

              {/* Posts & Intervals Configuration */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="posts_per_day">
                    Постів на день (макс: {tariff?.posts_per_day || 10})
                  </Label>
                  <Input
                    id="posts_per_day"
                    type="text"
                    value={botService?.posts_per_day || 10}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || !isNaN(parseInt(value))) {
                        const numValue = parseInt(value) || 0;
                        if (numValue >= 1 && numValue <= (tariff?.posts_per_day || 10)) {
                          updateBotServiceField('posts_per_day', numValue);
                        }
                      }
                    }}
                    placeholder="10"
                  />
                </div>

                {botService?.publish_old_posts !== false && (
                  <div className="space-y-2">
                    <Label htmlFor="post_interval">
                      Інтервал між постами (хвилин)
                    </Label>
                    <Input
                      id="post_interval"
                      type="text"
                      inputMode="numeric"
                      value={botService?.post_interval_minutes || ''}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === '' || /^\d*$/.test(value)) {
                          updateBotServiceField('post_interval_minutes', value === '' ? '' : parseInt(value));
                        }
                      }}
                      onBlur={(e) => {
                        const numValue = parseInt(e.target.value) || 60;
                        updateBotServiceField('post_interval_minutes', Math.max(1, numValue));
                      }}
                      onFocus={(e) => e.target.select()}
                      placeholder="60"
                    />
                  </div>
                )}
              </div>

              {hasUnsavedChanges && (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    У вас є незбережені зміни. Натисніть "Зберегти налаштування".
                  </AlertDescription>
                </Alert>
              )}

              {(sourceChannels.length > 0 || pendingSourceChannels.length > 0) ? (
                <Button 
                  onClick={handleSaveBotService} 
                  disabled={isSaving || !botVerified}
                  className="w-full h-12 text-base font-semibold"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                      Збереження...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5 mr-2" />
                      Зберегти налаштування
                    </>
                  )}
                </Button>
              ) : (
                <Alert>
                  <Info className="w-4 h-4" />
                  <AlertDescription>
                    {!botService 
                      ? "Додайте хоча б 1 канал-джерело для збереження налаштувань"
                      : "Немає джерел. Додайте канали для копіювання контенту"}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default BotSetup;
