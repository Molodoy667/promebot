import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ChannelInfo } from "@/components/ChannelInfo";
import { 
  Bot, 
  Play,
  Pause,
  Loader2,
  Info,
  TrendingUp,
  Settings,
  Trash2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Lock,
  Globe,
  Clock,
  Filter,
  Zap,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";

interface BotService {
  id: string;
  bot_id?: string | null;
  target_channel: string;
  posts_per_month?: number;
  post_interval_minutes: number;
  include_media: boolean;
  post_as_bot: boolean;
  is_running: boolean;
  keywords_filter: any;
  publish_immediately: boolean;
  publish_old_posts: boolean;
  subscription_id: string | null;
  created_at: string;
  started_at?: string | null;
  last_error?: string | null;
  last_error_at?: string | null;
  error_count?: number;
  subscription?: {
    tariff?: {
      name: string;
      sources_limit: number | null;
      posts_per_month: number;
    };
  };
}

interface AIBotService {
  id: string;
  target_channel: string;
  is_running: boolean;
  bot_id: string;
  service_type: string;
  created_at: string;
  started_at?: string | null;
  last_error?: string | null;
  last_error_at?: string | null;
  error_count?: number;
  subscription?: {
    tariff?: {
      name: string;
      sources_limit: number | null;
      posts_per_month: number;
    };
  };
  keywords_filter?: any;
  publishing_settings?: {
    time_from?: string | null;
    time_to?: string | null;
    post_interval_minutes?: number | null;
    include_media?: boolean;
    generate_tags?: boolean;
    use_custom_prompt?: boolean;
    custom_prompt?: string | null;
  };
}

interface SourceChannel {
  id: string;
  channel_username: string;
  is_active: boolean;
  bot_service_id: string;
}

interface AIContentSource {
  id: string;
  category: string;
  source_type: string;
  ai_bot_service_id: string;
}

interface TelegramBot {
  id: string;
  bot_token: string;
  bot_name: string | null;
  bot_username: string | null;
  bot_type: 'ai' | 'plagiarist' | null;
  status: string | null;
  is_active: boolean | null;
  user_id: string;
}

interface ChannelInfo {
  title: string;
  username?: string;
  photo_url?: string;
}

interface CategoryInfo {
  emoji: string;
  name: string;
}

interface ChannelGroup {
  type: 'plagiarist' | 'ai';
  service: BotService | AIBotService;
  bot: TelegramBot | null;
  sourceChannels?: SourceChannel[];
  categories?: CategoryInfo[];
  channelInfo: ChannelInfo | null;
}

const MyChannels = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [channelGroups, setChannelGroups] = useState<ChannelGroup[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<ChannelGroup | null>(null);
  const [deleteStats, setDeleteStats] = useState<{
    postsCount: number;
    sourceChannelsCount: number;
  } | null>(null);
  const [expandedChannels, setExpandedChannels] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<'ai' | 'plagiarist'>('ai');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'error'>('all');
  const [usageStats, setUsageStats] = useState<{
    bots_count: number;
    channels_count: number;
    sources_count: number;
    posts_month: number;
  } | null>(null);
  const [tariff, setTariff] = useState<any>(null);
  const [cooldowns, setCooldowns] = useState<Record<string, number>>({});

  // Load cooldowns from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('bot_cooldowns');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Record<string, number>;
        const now = Date.now();
        const restored: Record<string, number> = {};
        for (const [key, endTime] of Object.entries(parsed)) {
          const remaining = Math.ceil((endTime - now) / 1000);
          if (remaining > 0) {
            restored[key] = remaining;
          }
        }
        setCooldowns(restored);
      } catch (e) {
        console.error('Failed to parse cooldowns from localStorage:', e);
      }
    }
  }, []);

  // Cooldown timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setCooldowns(prev => {
        const updated: Record<string, number> = {};
        let hasChanges = false;
        for (const [key, value] of Object.entries(prev)) {
          if (value > 1) {
            updated[key] = value - 1;
            hasChanges = true;
          } else if (value === 1) {
            hasChanges = true;
            // Don't add to updated - cooldown finished
          }
        }
        // Update localStorage
        if (hasChanges) {
          const endTimes: Record<string, number> = {};
          const now = Date.now();
          for (const [key, seconds] of Object.entries(updated)) {
            endTimes[key] = now + seconds * 1000;
          }
          if (Object.keys(endTimes).length > 0) {
            localStorage.setItem('bot_cooldowns', JSON.stringify(endTimes));
          } else {
            localStorage.removeItem('bot_cooldowns');
          }
        }
        return hasChanges ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUser(session.user);
      await loadAllChannels(session.user.id);
      await loadUserTariff(session.user.id);
      await loadUsageStats(session.user.id);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        loadAllChannels(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const loadUserTariff = async (userId: string) => {
    try {
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
        setTariff(subscription.tariffs as any);
      }
    } catch (error) {
      console.error("Помилка завантаження тарифу:", error);
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
        bots_count: userData?.bots_used_count || 0,
        channels_count: userData?.channels_used_count || 0,
        sources_count: userData?.sources_used_count || 0,
        posts_month: userData?.posts_current_period || 0
      });
    } catch (error) {
      console.error("Помилка завантаження статистики:", error);
    }
  };

  // Real-time updates for channels
  useEffect(() => {
    if (!user?.id) return;

    // Bot services updates (plagiarist)
    const botServicesChannel = supabase
      .channel('my_channels_bot_services')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bot_services',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log('Bot services changed, reloading...');
          loadAllChannels(user.id);
          loadUsageStats(user.id); // Оновлюємо статистику
        }
      )
      .subscribe();

    // AI Bot services updates
    const aiServicesChannel = supabase
      .channel('my_channels_ai_services')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_bot_services',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          console.log('AI services changed, reloading...');
          loadAllChannels(user.id);
          loadUsageStats(user.id); // Оновлюємо статистику
        }
      )
      .subscribe();

    // Source channels updates
    const sourceChannelsChannel = supabase
      .channel('my_channels_source_channels')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'source_channels',
        },
        () => {
          console.log('Source channel changed');
          loadAllChannels(user.id);
        }
      )
      .subscribe();

    // AI content sources updates
    const aiSourcesChannel = supabase
      .channel('my_channels_ai_sources')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_content_sources',
        },
        () => {
          console.log('AI sources changed');
          loadAllChannels(user.id);
        }
      )
      .subscribe();

    // Telegram bots updates
    const telegramBotsChannel = supabase
      .channel('my_channels_telegram_bots')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'telegram_bots',
        },
        () => {
          console.log('Telegram bot changed, reloading...');
          loadAllChannels(user.id);
        }
      )
      .subscribe();

    return () => {
      botServicesChannel.unsubscribe();
      aiServicesChannel.unsubscribe();
      sourceChannelsChannel.unsubscribe();
      aiSourcesChannel.unsubscribe();
      telegramBotsChannel.unsubscribe();
    };
  }, [user?.id]);

  const getChannelInfo = async (channelUsername: string, botToken: string): Promise<ChannelInfo | null> => {
    try {
      let identifier = channelUsername.trim().replace('@', '');
      if (identifier.includes('t.me/')) {
        const match = identifier.match(/t\.me\/([^/?]+)/);
        if (match) identifier = match[1];
      }

      const isChatId = /^-?\d+$/.test(identifier);
      const chatIdentifier = isChatId ? identifier : `@${identifier}`;

      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getChat?chat_id=${chatIdentifier}`
      );
      const data = await response.json();

      if (data.ok) {
        let photoUrl = null;
        if (data.result.photo?.small_file_id) {
          const photoResponse = await fetch(
            `https://api.telegram.org/bot${botToken}/getFile?file_id=${data.result.photo.small_file_id}`
          );
          const photoData = await photoResponse.json();
          if (photoData.ok) {
            photoUrl = `https://api.telegram.org/file/bot${botToken}/${photoData.result.file_path}`;
          }
        }

        return {
          title: data.result.title || identifier,
          username: data.result.username,
          photo_url: photoUrl
        };
      }
    } catch (error) {
      console.error("Error fetching channel info:", error);
    }
    return null;
  };

  const loadAllChannels = async (userId: string) => {
    try {
      // Load all active bots
      const { data: bots, error: botsError } = await supabase
        .from("telegram_bots")
        .select("*")
        .eq("is_active", true);

      if (botsError) throw botsError;

      // Розрахувати статистику для кожного бота
      const botsWithStats = await Promise.all((bots || []).map(async (bot) => {
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
          // Рахуємо канали для плагіатор бота (всі bot_services користувача використовують один plagiarist бот)
          const { count: servicesCount } = await supabase
            .from("bot_services")
            .select("*", { count: 'exact', head: true })
            .eq("user_id", userId);
          channelsCount = servicesCount || 0;

          // Рахуємо пости для всіх сервісів користувача
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

      const plagiaristBot = botsWithStats?.find(b => b.bot_type === 'plagiarist');
      const aiBots = botsWithStats?.filter(b => b.bot_type === 'ai') || [];

      const groups: ChannelGroup[] = [];

      // Load plagiarist bot services
      const { data: services, error: servicesError } = await supabase
        .from("bot_services")
        .select(`
          *,
          subscription:subscriptions(
            id,
            tariff:tariffs(
              id,
              name,
              posts_per_month,
              channels_limit,
              bots_limit,
              sources_limit
            )
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (servicesError) throw servicesError;

      if (services && services.length > 0) {
        // Load source channels for plagiarist services
        const { data: channels } = await supabase
          .from("source_channels")
          .select("*")
          .in("bot_service_id", services.map(s => s.id));

        for (const service of services) {
          const channelInfo = plagiaristBot?.bot_token 
            ? await getChannelInfo(service.target_channel, plagiaristBot.bot_token)
            : null;

          groups.push({
            type: 'plagiarist',
            service: service,
            bot: plagiaristBot || null,
            sourceChannels: channels?.filter(ch => ch.bot_service_id === service.id) || [],
            channelInfo
          });
        }
      }

      // Load AI bot services
      const { data: aiServices, error: aiServicesError } = await supabase
        .from("ai_bot_services")
        .select(`
          *,
          subscription:subscriptions(
            id,
            tariff:tariffs(
              id,
              name,
              posts_per_month,
              channels_limit,
              bots_limit,
              sources_limit
            )
          )
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (aiServicesError) throw aiServicesError;

      if (aiServices && aiServices.length > 0) {
        // Load categories for AI services with names
        const { data: aiSources } = await supabase
          .from("ai_content_sources")
          .select("category, ai_bot_service_id")
          .in("ai_bot_service_id", aiServices.map(s => s.id))
          .eq("is_active", true);

        // Load publishing settings for AI services
        const { data: publishingSettings } = await supabase
          .from("ai_publishing_settings")
          .select("ai_bot_service_id, time_from, time_to, post_interval_minutes, include_media, generate_tags, use_custom_prompt, custom_prompt")
          .in("ai_bot_service_id", aiServices.map(s => s.id));

        const settingsMap = new Map(
          publishingSettings?.map(s => [s.ai_bot_service_id, s]) || []
        );

        // Get category names mapping
        const { data: categoryPrompts } = await supabase
          .from("category_prompts")
          .select("category_key, category_name, emoji");

        const categoryMap = new Map(
          categoryPrompts?.map(c => [c.category_key, { name: c.category_name, emoji: c.emoji }]) || []
        );

        for (const service of aiServices) {
          const bot = aiBots.find(b => b.id === service.bot_id);
          const channelInfo = bot?.bot_token
            ? await getChannelInfo(service.target_channel, bot.bot_token)
            : null;

          const categoryKeys = aiSources
            ?.filter(s => s.ai_bot_service_id === service.id)
            .map(s => s.category)
            .filter((v, i, a) => a.indexOf(v) === i) || [];

          // Map category keys to CategoryInfo objects
          const categories: CategoryInfo[] = categoryKeys.map(key => {
            const catInfo = categoryMap.get(key);
            return catInfo 
              ? { emoji: catInfo.emoji || '📝', name: catInfo.name } 
              : { emoji: '📝', name: key };
          });

          const settings = settingsMap.get(service.id);

          groups.push({
            type: 'ai',
            service: {
              ...service,
              publishing_settings: settings || undefined
            },
            bot: bot || null,
            categories,
            channelInfo
          });
        }
      }

      setChannelGroups(groups);
    } catch (error: any) {
      console.error("Error loading channels:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatUptime = (startedAt: string | null | undefined) => {
    if (!startedAt) return '';
    
    const now = Date.now();
    const started = new Date(startedAt).getTime();
    const diffMs = now - started;
    
    const minutes = Math.floor(diffMs / 60000);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}д ${hours % 24}год`;
    } else if (hours > 0) {
      return `${hours}год ${minutes % 60}хв`;
    } else if (minutes > 0) {
      return `${minutes}хв`;
    } else {
      return 'щойно';
    }
  };

  const handleToggleBotStatus = async (group: ChannelGroup) => {
    console.log('🚀 MyChannels handleToggleBotStatus called!');
    console.log('Group:', group.type, 'Service ID:', group.service.id);
    
    if (group.type === 'plagiarist') {
      if (!group.sourceChannels || group.sourceChannels.length === 0) {
        toast({
          title: "Помилка",
          description: "Додайте хоча б один джерельний канал",
          variant: "destructive",
          duration: 1500,
        });
        return;
      }
    } else if (group.type === 'ai') {
      // Перевіряємо тільки при запуску
      if (!group.service.is_running) {
        const settings = (group.service as AIBotService).publishing_settings;
        // Якщо не використовується власний промпт, то потрібні категорії
        if (!settings?.use_custom_prompt && (!group.categories || group.categories.length === 0)) {
          toast({
            title: "Помилка",
            description: "Виберіть хоча б одну категорію або налаштуйте власний промпт",
            variant: "destructive",
            duration: 1500,
          });
          return;
        }
      }
    }

    try {
      const newStatus = !group.service.is_running;
      const table = group.type === 'plagiarist' ? 'bot_services' : 'ai_bot_services';
      
      console.log('⚙️ Toggling to:', newStatus);
      
      const updateData: any = { 
        is_running: newStatus,
        started_at: newStatus ? new Date().toISOString() : group.service.started_at
      };
      
      const { error } = await supabase
        .from(table)
        .update(updateData)
        .eq("id", group.service.id);

      if (error) throw error;

      // Створюємо сповіщення через прямий INSERT
      if (user) {
        console.log('🔔 Creating notification for user:', user.id);
        const botName = group.bot?.bot_name || (group.type === 'ai' ? 'AI Бот' : 'Плагіатор');
        const channelName = group.channelInfo?.title || group.service.target_channel;
        
        // Перевіряємо налаштування
        const { data: settings } = await supabase
          .from('notification_settings')
          .select('bot_status_enabled')
          .eq('user_id', user.id)
          .maybeSingle();

        const isEnabled = settings?.bot_status_enabled ?? true;
        console.log('Bot notifications enabled:', isEnabled);

        if (isEnabled) {
          if (newStatus) {
            console.log('▶️ Bot started - creating notification via INSERT');
            await supabase.from('notifications').insert({
              user_id: user.id,
              type: 'bot_started',
              title: 'Бот запущено',
              message: `Бот "${botName}" прив'язаний до каналу "${channelName}" розпочав свою роботу`,
              link: '/my-channels'
            });
          } else {
            console.log('⏸️ Bot stopped - creating notification via INSERT');
            const runtimeHours = group.service.started_at 
              ? (Date.now() - new Date(group.service.started_at).getTime()) / (1000 * 60 * 60)
              : 0;
            console.log('⏱️ Runtime:', runtimeHours, 'hours');
            
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
              message: `Бот "${botName}" прив'язаний до каналу "${channelName}" припинив свою роботу, пропрацювавши ${runtimeText}`,
              link: '/my-channels'
            });
          }
          console.log('✅ Notification created via INSERT');
        } else {
          console.log('⚠️ Bot notifications disabled for user');
        }
      } else {
        console.warn('⚠️ No user found for notification');
      }

      // Для AI бота - генеруємо 1 початковий пост при запуску
      if (group.type === 'ai' && newStatus) {
        await supabase.functions.invoke("generate-ai-posts", {
          body: { serviceId: group.service.id, count: 1 },
        });
      }

      // Update local state
      setChannelGroups(channelGroups.map(g => 
        g.service.id === group.service.id 
          ? { ...g, service: { ...g.service, is_running: newStatus, started_at: updateData.started_at } }
          : g
      ));

      // Start 60 second cooldown and save to localStorage
      const endTime = Date.now() + 60 * 1000;
      setCooldowns(prev => {
        const updated = { ...prev, [group.service.id]: 60 };
        // Save to localStorage
        const stored = localStorage.getItem('bot_cooldowns');
        const endTimes = stored ? JSON.parse(stored) : {};
        endTimes[group.service.id] = endTime;
        localStorage.setItem('bot_cooldowns', JSON.stringify(endTimes));
        return updated;
      });

      toast({
        title: newStatus ? "Бот запущено" : "Бот зупинено",
        description: newStatus 
          ? "Бот розпочав роботу" 
          : "Бот призупинив свою роботу",
        duration: 1500,
      });
    } catch (error: any) {
      console.error("Error toggling bot status:", error);
      
      // Створюємо сповіщення про помилку
      if (user) {
        const botName = group.bot?.bot_name || (group.type === 'ai' ? 'AI Бот' : 'Плагіатор');
        const channelName = group.channelInfo?.title || group.service.target_channel;
        
        await (supabase.rpc as any)('create_bot_error_notification', {
          p_user_id: user.id,
          p_bot_name: botName,
          p_channel_name: channelName,
          p_error_message: error.message || 'Невідома помилка',
          p_service_type: group.type === 'ai' ? 'ai' : 'plagiarist'
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

  const handleDeleteChannel = async (group: ChannelGroup) => {
    try {
      let postsCount = 0;
      let sourceCount = 0;

      if (group.type === 'plagiarist') {
        const { count } = await supabase
          .from("posts_history")
          .select("*", { count: 'exact', head: true })
          .eq("bot_service_id", group.service.id);
        postsCount = count || 0;
        sourceCount = group.sourceChannels?.length || 0;
      } else {
        const { count } = await supabase
          .from("ai_generated_posts")
          .select("*", { count: 'exact', head: true })
          .eq("ai_bot_service_id", group.service.id);
        postsCount = count || 0;
        sourceCount = group.categories?.length || 0;
      }
      
      setDeleteStats({
        postsCount,
        sourceChannelsCount: sourceCount,
      });
      setGroupToDelete(group);
      setDeleteDialogOpen(true);
    } catch (error) {
      console.error("Error fetching delete stats:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося отримати статистику для видалення",
        variant: "destructive",
      });
    }
  };

  const confirmDeleteChannel = async () => {
    if (!groupToDelete) return;

    try {
      const table = groupToDelete.type === 'plagiarist' ? 'bot_services' : 'ai_bot_services';
      
      const { error: serviceError } = await supabase
        .from(table)
        .delete()
        .eq("id", groupToDelete.service.id);

      if (serviceError) throw serviceError;

      // Update local state
      setChannelGroups(channelGroups.filter(g => g.service.id !== groupToDelete.service.id));

      toast({
        title: "Канал видалено",
        description: "Канал та вся його історія успішно видалені",
        duration: 2000,
      });
      
      setDeleteDialogOpen(false);
      setGroupToDelete(null);
      setDeleteStats(null);
    } catch (error: any) {
      console.error("Error deleting channel:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося видалити канал",
        variant: "destructive",
        duration: 1500,
      });
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  if (channelGroups.length === 0) {
    return (
      <div className="min-h-screen">
        <PageBreadcrumbs />
        <main className="container mx-auto px-4 py-8 max-w-2xl">
          <Card className="p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
              <Bot className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Немає налаштованих каналів</h2>
            <p className="text-muted-foreground mb-6">
              Спочатку налаштуйте бота та додайте канали
            </p>
            <Button onClick={() => navigate("/bot-setup")}>
              Налаштувати бота
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  // Filter channels
  const filterChannels = (groups: ChannelGroup[]) => {
    return groups.filter(group => {
      // Filter by tab
      if (group.type !== activeTab) return false;
      
      // Filter by status
      if (statusFilter === 'active' && !group.service.is_running) return false;
      if (statusFilter === 'inactive' && (group.service.is_running || group.service.last_error)) return false;
      if (statusFilter === 'error' && !group.service.last_error) return false;
      
      return true;
    });
  };

  const filteredChannels = filterChannels(channelGroups);
  const aiCount = channelGroups.filter(g => g.type === 'ai').length;
  const plagiaristCount = channelGroups.filter(g => g.type === 'plagiarist').length;

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />

      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <PageHeader
          icon={Bot}
          title="Мої канали"
          description="Керуйте своїми Telegram каналами та налаштуйте автоматизацію публікацій"
        >
          {tariff && (
            <Button onClick={() => navigate("/bot-setup")} className="gap-2 mt-4">
              <Plus className="w-4 h-4" />
              Додати канал
            </Button>
          )}
        </PageHeader>

        {/* Usage Limits */}
        {usageStats && (
          <Card className="p-6 bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Ваші ліміти - {tariff?.name || 'Безкоштовний'}
              </h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Боти</p>
                <p className="text-2xl font-bold">
                  {usageStats.bots_count} / {tariff?.bots_limit || 1}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Канали</p>
                <p className="text-2xl font-bold">
                  {usageStats.channels_count} / {tariff?.channels_limit || 1}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Джерела</p>
                <p className="text-2xl font-bold">
                  {usageStats.sources_count} / {tariff?.sources_limit || 5}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Пости (за місяць)</p>
                <p className="text-2xl font-bold">
                  {usageStats.posts_month}
                  {tariff?.posts_per_month && (
                    <span className="text-sm text-muted-foreground font-normal"> / {tariff.posts_per_month}</span>
                  )}
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Tabs and Filters */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'ai' | 'plagiarist')} className="mb-6">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-4">
            <TabsList className="grid w-full sm:w-auto grid-cols-2">
              <TabsTrigger value="ai" className="gap-2">
                <Sparkles className="w-4 h-4" />
                AI ({aiCount})
              </TabsTrigger>
              <TabsTrigger value="plagiarist" className="gap-2">
                <Bot className="w-4 h-4" />
                Плагіатори ({plagiaristCount})
              </TabsTrigger>
            </TabsList>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              <Button
                variant={statusFilter === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('all')}
              >
                Всі
              </Button>
              <Button
                variant={statusFilter === 'active' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('active')}
                className="gap-1"
              >
                <div className="w-2 h-2 rounded-full bg-success"></div>
                Активні
              </Button>
              <Button
                variant={statusFilter === 'inactive' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('inactive')}
                className="gap-1"
              >
                <div className="w-2 h-2 rounded-full bg-muted-foreground"></div>
                Неактивні
              </Button>
              <Button
                variant={statusFilter === 'error' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter('error')}
                className="gap-1"
              >
                <AlertTriangle className="w-3 h-3 text-destructive" />
                Помилки
              </Button>
            </div>
          </div>

          <TabsContent value={activeTab} className="space-y-6 mt-0">
            {filteredChannels.length === 0 ? (
              <Card className="p-8 text-center">
                <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-4 flex items-center justify-center">
                  {activeTab === 'ai' ? <Sparkles className="w-8 h-8 text-muted-foreground" /> : <Bot className="w-8 h-8 text-muted-foreground" />}
                </div>
                <h3 className="text-xl font-bold mb-2">
                  {statusFilter === 'all' 
                    ? `Немає ${activeTab === 'ai' ? 'AI' : 'плагіатор'} каналів`
                    : `Немає каналів з фільтром "${statusFilter === 'active' ? 'Активні' : statusFilter === 'inactive' ? 'Неактивні' : 'Помилки'}"`
                  }
                </h3>
                <p className="text-muted-foreground mb-6">
                  {statusFilter === 'all' ? 'Додайте свій перший канал' : 'Спробуйте інший фільтр'}
                </p>
                {statusFilter === 'all' && tariff && (
                  <Button onClick={() => navigate("/bot-setup")}>
                    <Plus className="w-4 h-4 mr-2" />
                    Додати канал
                  </Button>
                )}
              </Card>
            ) : (
              filteredChannels.map((group, index) => {
            const isExpanded = expandedChannels.has(group.service.id);
            
            return (
              <Card 
                key={group.service.id} 
                className="p-6 bg-gradient-to-br from-background to-muted/20 hover:shadow-lg transition-shadow"
              >
                {/* Header with Channel Info */}
                <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
                  <div className="flex-1 w-full">
                    <div className="flex items-center gap-3 mb-2">
                      {group.channelInfo?.photo_url ? (
                        <img 
                          src={group.channelInfo.photo_url} 
                          alt={group.channelInfo.title}
                          className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow flex-shrink-0">
                          <Bot className="w-6 h-6 text-primary-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h3 className="text-xl font-bold truncate">
                          {group.channelInfo?.title || group.service.target_channel}
                        </h3>
                        {group.channelInfo?.username && (
                          <a 
                            href={`https://t.me/${group.channelInfo.username}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline truncate block"
                            onClick={(e) => e.stopPropagation()}
                          >
                            @{group.channelInfo.username}
                          </a>
                        )}
                      </div>
                    </div>
                    
                    {/* Tariff Info */}
                    {group.service.subscription?.tariff && (
                      <div className="mt-3 p-3 bg-primary/5 border border-primary/10 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center">
                            <TrendingUp className="w-4 h-4 text-primary" />
                          </div>
                          <span className="text-sm font-semibold">
                            Ваш тариф: {group.service.subscription.tariff.name}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {group.type === 'plagiarist' && (
                            <span>
                              Джерел: <strong>{group.sourceChannels?.filter(ch => ch.is_active).length || 0}</strong> / {group.service.subscription.tariff.sources_limit || '∞'}
                            </span>
                          )}
                          {group.type === 'ai' && (
                            <span>
                              Категорій: <strong>{group.categories?.length || 0}</strong> / {group.service.subscription.tariff.sources_limit || '∞'}
                            </span>
                          )}
                          <span>
                            Постів/місяць: {group.service.subscription.tariff.posts_per_month || '∞'}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <Badge variant={group.service.is_running ? "default" : "secondary"}>
                        {group.service.is_running ? "Активний" : "Не активний"}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        {group.type === 'ai' ? (
                          <>
                            <Sparkles className="w-3 h-3" />
                            AI Бот
                          </>
                        ) : (
                          <>
                            <Bot className="w-3 h-3" />
                            Плагіатор
                          </>
                        )}
                      </Badge>
                      <Badge variant="outline" className="gap-1">
                        {group.channelInfo?.username ? (
                          <>
                            <Globe className="w-3 h-3 text-green-500" />
                            Публічний
                          </>
                        ) : (
                          <>
                            <Lock className="w-3 h-3 text-amber-500" />
                            Приватний
                          </>
                        )}
                      </Badge>
                      {group.type === 'plagiarist' && (
                        <Badge variant="outline">
                          {group.sourceChannels?.filter(ch => ch.is_active).length || 0} джерел
                        </Badge>
                      )}
                      {group.type === 'ai' && (
                        <Badge variant="outline">
                          {group.categories?.length || 0} категорій
                        </Badge>
                      )}
                      {group.type === 'plagiarist' && group.service.keywords_filter && Array.isArray(group.service.keywords_filter) && group.service.keywords_filter.length > 0 && (
                        <Badge variant="outline" className="gap-1">
                          🔍 Фільтр ({group.service.keywords_filter.length} слів)
                        </Badge>
                      )}
                    </div>

                    {/* Bot Info */}
                    {group.bot && (
                      <div className="mt-3 p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Bot className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-muted-foreground">Підключений бот</p>
                            <p className="text-sm font-medium truncate">
                              {group.bot.bot_name || "Без назви"}
                            </p>
                            {group.bot.bot_username && (
                              <p className="text-xs text-muted-foreground">@{group.bot.bot_username}</p>
                            )}
                          </div>
                        </div>
                        <div className="pt-2 border-t border-border/30 space-y-1.5">
                          {group.service.last_error ? (
                            <>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"></div>
                                <p className="text-xs text-destructive font-medium flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3" />
                                  Помилка
                                </p>
                              </div>
                              <div className="text-xs text-muted-foreground bg-destructive/10 rounded p-2 mt-1">
                                {group.service.last_error}
                              </div>
                            </>
                          ) : (
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${group.service.is_running ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`}></div>
                              <p className="text-xs text-muted-foreground">
                                {group.service.is_running ? (
                                  <>
                                    Працює {formatUptime(group.service.started_at)}
                                  </>
                                ) : (
                                  'Не працює'
                                )}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Settings Info */}
                    {group.type === 'plagiarist' && (
                      <div className="mt-3 p-3 bg-accent/30 rounded-lg border border-border/30">
                        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                          <Settings className="w-3.5 h-3.5" />
                          Налаштування публікації
                        </h4>
                        <div className="space-y-1.5 text-xs">
                          {group.service.keywords_filter && Array.isArray(group.service.keywords_filter) && group.service.keywords_filter.length > 0 ? (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground flex items-center gap-1.5">
                                <Filter className="w-3 h-3" />
                                Фільтри публікації
                              </span>
                              <span className="font-medium">
                                {group.service.keywords_filter.length} слів
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between">
                              <span className="text-muted-foreground flex items-center gap-1.5">
                                <Filter className="w-3 h-3" />
                                Фільтри публікації
                              </span>
                              <span className="font-medium text-muted-foreground">
                                Не активно
                              </span>
                            </div>
                          )}
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              Публікація за таймером
                            </span>
                            <span className="font-medium">
                              {((group.service as BotService).post_interval_minutes || 60) === 60 
                                ? 'За замовчуванням' 
                                : `${(group.service as BotService).post_interval_minutes} хв`}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* AI Bot Settings Info */}
                    {group.type === 'ai' && (
                      <div className="mt-3 p-3 bg-accent/30 rounded-lg border border-border/30">
                        <h4 className="text-xs font-semibold mb-2 flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5" />
                          Налаштування публікації
                        </h4>
                        <div className="space-y-1.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              Публікувати в певний час
                            </span>
                            {(group.service as AIBotService).publishing_settings?.time_from && 
                             (group.service as AIBotService).publishing_settings?.time_to ? (
                              <span className="font-medium">
                                {(group.service as AIBotService).publishing_settings!.time_from} - {(group.service as AIBotService).publishing_settings!.time_to}
                              </span>
                            ) : (
                              <span className="font-medium text-muted-foreground">
                                Не активно
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Clock className="w-3 h-3" />
                              Відкладена публікація
                            </span>
                            <span className="font-medium">
                              {(group.service as AIBotService).publishing_settings?.post_interval_minutes 
                                ? `${(group.service as AIBotService).publishing_settings!.post_interval_minutes} хв`
                                : 'За замовчуванням (60 хв)'}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Zap className="w-3 h-3" />
                              Зображення
                            </span>
                            {(group.service as AIBotService).publishing_settings?.include_media ? (
                              <span className="font-medium text-success">✓ Активно</span>
                            ) : (
                              <span className="font-medium text-muted-foreground">Не активно</span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Zap className="w-3 h-3" />
                              Теги
                            </span>
                            {(group.service as AIBotService).publishing_settings?.generate_tags ? (
                              <span className="font-medium text-success">✓ Активно</span>
                            ) : (
                              <span className="font-medium text-muted-foreground">Не активно</span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                </div>

                <Separator className="mb-4" />

                {/* Start/Stop Button */}
                <Button
                  onClick={() => {
                    console.log('🖱️ Button clicked!', group.service.id);
                    handleToggleBotStatus(group);
                  }} 
                  size="default" 
                  variant={group.service.is_running ? "destructive" : "default"} 
                  className="gap-2 w-full mb-4"
                  disabled={cooldowns[group.service.id] > 0}
                >
                  {cooldowns[group.service.id] > 0 ? (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>Зачекайте {cooldowns[group.service.id]} сек</span>
                    </>
                  ) : group.service.is_running ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Зупинити бота</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4" />
                      <span>Запустити бота</span>
                    </>
                  )}
                </Button>

                {/* Content based on type */}
                {group.type === 'plagiarist' && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold">Джерельні канали</h4>
                      <Badge variant="outline" className="text-xs">
                        {group.sourceChannels?.filter(ch => ch.is_active).length || 0} активних
                      </Badge>
                    </div>

                    {group.sourceChannels && group.sourceChannels.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {group.sourceChannels.slice(0, 5).map((channel) => (
                          <Badge key={channel.id} variant="secondary" className="text-xs">
                            {channel.channel_username}
                          </Badge>
                        ))}
                        {group.sourceChannels.length > 5 && (
                          <Badge variant="secondary" className="text-xs">
                            +{group.sourceChannels.length - 5} більше
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <Alert className="py-2">
                        <Info className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                          Немає джерельних каналів
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {group.type === 'ai' && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold">
                        {(group.service as AIBotService).publishing_settings?.use_custom_prompt ? 'Власний промпт' : 'Категорії постів'}
                      </h4>
                      <Badge variant="outline" className="text-xs">
                        {(group.service as AIBotService).publishing_settings?.use_custom_prompt 
                          ? 'Кастомний' 
                          : `${group.categories?.length || 0} категорій`}
                      </Badge>
                    </div>

                    {(group.service as AIBotService).publishing_settings?.use_custom_prompt ? (
                      <div className="p-3 bg-muted/50 rounded-lg border border-border/30">
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {(group.service as AIBotService).publishing_settings?.custom_prompt || 'Власний промпт налаштовано'}
                        </p>
                      </div>
                    ) : group.categories && group.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {group.categories.map((category, idx) => (
                          <Badge key={idx} variant="secondary" className="text-xs gap-1 items-center">
                            {getCategoryIcon(category.emoji, "w-3.5 h-3.5")}
                            <span>{category.name}</span>
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <Alert className="py-2">
                        <Info className="w-4 h-4" />
                        <AlertDescription className="text-xs">
                          Не вибрано категорій
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                {/* Collapsible Actions */}
                <Collapsible
                  open={isExpanded}
                  onOpenChange={(open) => {
                    setExpandedChannels(prev => {
                      const newSet = new Set(prev);
                      if (open) {
                        newSet.add(group.service.id);
                      } else {
                        newSet.delete(group.service.id);
                      }
                      return newSet;
                    });
                  }}
                >
                  <CollapsibleTrigger asChild>
                    <Button 
                      variant="ghost" 
                      className="w-full justify-between"
                      size="sm"
                    >
                      <span className="text-sm">Налаштування каналу</span>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </Button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent className="pt-4 space-y-2">
                    <Button 
                      onClick={() => {
                        navigate("/channel-stats", { 
                          state: { 
                            serviceId: group.service.id,
                            serviceType: group.type,
                            channelName: group.service.target_channel
                          } 
                        });
                      }}
                      variant="default"
                      className="w-full"
                    >
                      <BarChart3 className="w-4 h-4 mr-2" />
                      Статистика каналу
                    </Button>
                    
                    <Button 
                      onClick={() => {
                        if (group.type === 'plagiarist') {
                          navigate("/bot-setup", { state: { botServiceId: group.service.id } });
                        } else {
                          const aiService = group.service as AIBotService;
                          navigate("/ai-bot-config", { state: { botId: aiService.bot_id, aiServiceId: aiService.id } });
                        }
                      }}
                      variant="outline"
                      className="w-full"
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Редагувати налаштування
                    </Button>
                    
                    <Button 
                      onClick={() => handleDeleteChannel(group)}
                      variant="destructive"
                      className="w-full"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Видалити канал
                    </Button>
                  </CollapsibleContent>
                </Collapsible>
              </Card>
            );
          })
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити канал?</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p className="text-base font-medium">
                Ви впевнені, що хочете видалити канал <strong>{groupToDelete?.service.target_channel}</strong>?
              </p>
              
              {deleteStats && (
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <p className="font-semibold text-foreground">Буде видалено:</p>
                  <ul className="space-y-1 text-sm">
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-destructive rounded-full" />
                      <span><strong>{deleteStats.sourceChannelsCount}</strong> джерельних каналів</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-destructive rounded-full" />
                      <span><strong>{deleteStats.postsCount}</strong> записів історії публікацій</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <span className="w-2 h-2 bg-destructive rounded-full" />
                      <span>Всі налаштування цього каналу</span>
                    </li>
                  </ul>
                </div>
              )}
              
              <p className="text-destructive font-medium">
                Цю дію неможливо скасувати!
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmDeleteChannel}
              className="bg-destructive hover:bg-destructive/90"
            >
              Так, видалити назавжди
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default MyChannels;

