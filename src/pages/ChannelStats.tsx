import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { 
  ArrowLeft, 
  BarChart3, 
  TrendingUp, 
  MessageSquare, 
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  Sparkles,
  Bot,
  Lock,
  Globe,
  Users,
  Eye,
  Award,
  Trash2,
  AlertTriangle,
  Heart,
  RefreshCw,
  Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatsDisplay } from "@/components/StatsDisplay";

interface ChannelStats {
  totalPosts: number;
  publishedPosts: number;
  failedPosts: number;
  pendingPosts: number;
  scheduledPosts: number;
  todayPosts: number;
  weekPosts: number;
  monthPosts: number;
  lastPostDate: string | null;
  avgPostsPerDay: number;
  sourcesCount: number;
  totalViews: number;
  avgViewsPerPost: number;
  totalReactions: number;
  avgReactionsPerPost: number;
}

interface ChannelInfo {
  title: string;
  username: string;
  type: string;
  photo?: string;
  description?: string;
  membersCount?: number;
  isPrivate?: boolean;
  subscribersToday?: number;
  subscribersWeek?: number;
  subscribersMonth?: number;
  viewsToday?: number;
  viewsWeek?: number;
  viewsMonth?: number;
  reactionsToday?: number;
  reactionsWeek?: number;
  reactionsMonth?: number;
}

export default function ChannelStats() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<ChannelStats | null>(null);
  const [channelInfo, setChannelInfo] = useState<ChannelInfo | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'subscribers' | 'views' | 'reactions'>('all');
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const { serviceId, serviceType, channelName } = location.state || {};
  
  // Helper function to check if card should be visible
  const shouldShowCard = (category: 'posts' | 'subscribers' | 'views' | 'reactions') => {
    if (activeTab === 'all') return true;
    return activeTab === category;
  };

  useEffect(() => {
    if (!serviceId || !serviceType) {
      toast({
        title: "Помилка",
        description: "Не вказано канал для статистики",
        variant: "destructive",
      });
      navigate("/my-channels");
      return;
    }

    loadStats();

    // Setup real-time subscriptions for posts updates
    const table = serviceType === 'plagiarist' ? 'posts_history' : 'ai_generated_posts';
    const idField = serviceType === 'plagiarist' ? 'bot_service_id' : 'ai_bot_service_id';
    
    const subscription = supabase
      .channel(`stats_${serviceId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT, UPDATE, DELETE
          schema: 'public',
          table: table,
          filter: `${idField}=eq.${serviceId}`
        },
        (payload) => {
          console.log('📊 Real-time stats update:', payload.eventType);
          // Reload stats when posts change
          loadStats();
        }
      )
      .subscribe();

    // Stats are auto-updated by bot-worker every 5 minutes
    // No need for client-side interval

    return () => {
      subscription.unsubscribe();
    };
  }, [serviceId, serviceType]);

  const loadStats = async () => {
    try {
      setIsLoading(true);
      
      // Load channel info from Telegram
      await loadChannelInfo();
      
      if (serviceType === 'plagiarist') {
        await loadPlagiaristStats();
      } else if (serviceType === 'ai') {
        await loadAIStats();
      }
    } catch (error) {
      console.error("Error loading stats:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити статистику",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadChannelInfo = async () => {
    try {
      // Get bot token
      const table = serviceType === 'plagiarist' ? 'bot_services' : 'ai_bot_services';
      const { data: service } = await supabase
        .from(table)
        .select('bot_id')
        .eq('id', serviceId)
        .single();

      if (!service?.bot_id) return;

      const { data: bot } = await supabase
        .from('telegram_bots')
        .select('bot_token')
        .eq('id', service.bot_id)
        .single();

      if (!bot?.bot_token) return;

      // Get channel info from Telegram API
      const response = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getChat?chat_id=${channelName}`);
      const data = await response.json();

      if (data.ok) {
        const chat = data.result;
        
        // Get photo URL if exists
        let photoUrl = undefined;
        if (chat.photo?.big_file_id) {
          try {
            const fileResponse = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getFile?file_id=${chat.photo.big_file_id}`);
            const fileData = await fileResponse.json();
            if (fileData.ok) {
              photoUrl = `https://api.telegram.org/file/bot${bot.bot_token}/${fileData.result.file_path}`;
            }
          } catch (err) {
            console.error("Error getting photo:", err);
          }
        }
        
        // Get member count for channels (getChat doesn't return members_count for channels)
        let membersCount = chat.members_count;
        if (!membersCount && (chat.type === 'channel' || chat.type === 'supergroup')) {
          try {
            const membersResponse = await fetch(`https://api.telegram.org/bot${bot.bot_token}/getChatMemberCount?chat_id=${channelName}`);
            const membersData = await membersResponse.json();
            if (membersData.ok) {
              membersCount = membersData.result;
            }
          } catch (err) {
            console.error("Error getting member count:", err);
          }
        }
        
        // Рахуємо зміни підписників, переглядів та реакцій
        let subscribersToday = 0, subscribersWeek = 0, subscribersMonth = 0;
        let viewsToday = 0, viewsWeek = 0, viewsMonth = 0;
        let reactionsToday = 0, reactionsWeek = 0, reactionsMonth = 0;
        
        const currentViews = stats?.totalViews || 0;
        const currentReactions = stats?.totalReactions || 0;
        
        if (membersCount || currentViews || currentReactions) {
          // За сьогодні
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { data: todayRecord } = await (supabase
          .from('channel_stats_history' as any)
          .select('subscribers_count, total_views, total_reactions')
          .eq('service_id', serviceId)
          .eq('service_type', serviceType)
          .gte('recorded_at', today.toISOString())
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle() as any);
        
        const todayRow: any = todayRecord;
        if (todayRow) {
          subscribersToday = (membersCount || 0) - (todayRow.subscribers_count || 0);
          viewsToday = currentViews - (todayRow.total_views || 0);
          reactionsToday = currentReactions - (todayRow.total_reactions || 0);
        }
        
        // За тиждень
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data: weekRecord } = await (supabase
          .from('channel_stats_history' as any)
          .select('subscribers_count, total_views, total_reactions')
          .eq('service_id', serviceId)
          .eq('service_type', serviceType)
          .lte('recorded_at', weekAgo.toISOString())
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle() as any);
        
        const weekRow: any = weekRecord;
        if (weekRow) {
          subscribersWeek = (membersCount || 0) - (weekRow.subscribers_count || 0);
          viewsWeek = currentViews - (weekRow.total_views || 0);
          reactionsWeek = currentReactions - (weekRow.total_reactions || 0);
        }
        
        // За місяць
        const monthAgo = new Date();
        monthAgo.setDate(monthAgo.getDate() - 30);
        const { data: monthRecord } = await (supabase
          .from('channel_stats_history' as any)
          .select('subscribers_count, total_views, total_reactions')
          .eq('service_id', serviceId)
          .eq('service_type', serviceType)
          .lte('recorded_at', monthAgo.toISOString())
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle() as any);
        
        const monthRow: any = monthRecord;
        if (monthRow) {
          subscribersMonth = (membersCount || 0) - (monthRow.subscribers_count || 0);
          viewsMonth = currentViews - (monthRow.total_views || 0);
          reactionsMonth = currentReactions - (monthRow.total_reactions || 0);
        }
        
        await supabase
          .from('channel_stats_history' as any)
          .upsert({
            service_id: serviceId,
            service_type: serviceType,
            channel_name: channelName,
            subscribers_count: membersCount,
            total_views: stats?.totalViews || 0,
            total_reactions: stats?.totalReactions || 0,
            recorded_at: new Date().toISOString(),
          });
        }
        
        setChannelInfo({
          title: chat.title || channelName,
          username: chat.username || channelName,
          type: chat.type === 'channel' ? 'Канал' : chat.type === 'supergroup' ? 'Супергрупа' : 'Група',
          photo: photoUrl,
          description: chat.description,
          membersCount: membersCount,
          isPrivate: !chat.username,
          subscribersToday,
          subscribersWeek,
          subscribersMonth,
          viewsToday,
          viewsWeek,
          viewsMonth,
          reactionsToday,
          reactionsWeek,
          reactionsMonth,
        });
      }
    } catch (error) {
      console.error("Error loading channel info:", error);
      // Set minimal info if API fails
      setChannelInfo({
        title: channelName,
        username: channelName,
        type: 'Канал',
        isPrivate: channelName.startsWith('-'), // Private channels usually start with -
      });
    }
  };

  const loadPlagiaristStats = async () => {
    // Total posts
    const { count: totalPosts } = await supabase
      .from("posts_history")
      .select("*", { count: 'exact', head: true })
      .eq("bot_service_id", serviceId);

    // Published posts
    const { count: publishedPosts } = await supabase
      .from("posts_history")
      .select("*", { count: 'exact', head: true })
      .eq("bot_service_id", serviceId)
      .in("status", ["published", "success"]);

    // Failed posts
    const { count: failedPosts } = await supabase
      .from("posts_history")
      .select("*", { count: 'exact', head: true })
      .eq("bot_service_id", serviceId)
      .eq("status", "failed");

    // Pending posts
    const { count: pendingPosts } = await supabase
      .from("posts_history")
      .select("*", { count: 'exact', head: true })
      .eq("bot_service_id", serviceId)
      .eq("status", "pending");

    // Today posts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayPosts } = await supabase
      .from("posts_history")
      .select("*", { count: 'exact', head: true })
      .eq("bot_service_id", serviceId)
      .in("status", ["published", "success"])
      .gte("created_at", today.toISOString());

    // Week posts
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: weekPosts } = await supabase
      .from("posts_history")
      .select("*", { count: 'exact', head: true })
      .eq("bot_service_id", serviceId)
      .in("status", ["published", "success"])
      .gte("created_at", weekAgo.toISOString());

    // Month posts
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const { count: monthPosts } = await supabase
      .from("posts_history")
      .select("*", { count: 'exact', head: true })
      .eq("bot_service_id", serviceId)
      .in("status", ["published", "success"])
      .gte("created_at", monthAgo.toISOString());

    // Last post date
    const { data: lastPost } = await supabase
      .from("posts_history")
      .select("created_at")
      .eq("bot_service_id", serviceId)
      .in("status", ["published", "success"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Sources count
    const { count: sourcesCount } = await supabase
      .from("source_channels")
      .select("*", { count: 'exact', head: true })
      .eq("bot_service_id", serviceId)
      .eq("is_active", true);

    // Calculate average posts per day
    const { data: firstPost } = await supabase
      .from("posts_history")
      .select("created_at")
      .eq("bot_service_id", serviceId)
      .in("status", ["published", "success"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let avgPostsPerDay = 0;
    if (firstPost && publishedPosts) {
      const daysSinceFirst = Math.ceil((Date.now() - new Date(firstPost.created_at).getTime()) / (1000 * 60 * 60 * 24));
      avgPostsPerDay = daysSinceFirst > 0 ? publishedPosts / daysSinceFirst : 0;
    }

    // Calculate views (from hybrid stats, views column may not exist in DB)
    const { data: postsWithViewStats } = await supabase
      .from("posts_history")
      .select("scraping_stats, mtproto_stats")
      .eq("bot_service_id", serviceId)
      .in("status", ["published", "success"]);

    const totalViews = (postsWithViewStats || []).reduce((sum, post: any) => {
      const scrapingViews = post.scraping_stats?.views ?? 0;
      const mtprotoViews = post.mtproto_stats?.views ?? 0;
      return sum + Math.max(scrapingViews, mtprotoViews);
    }, 0);
    const avgViewsPerPost = publishedPosts ? Math.round(totalViews / publishedPosts) : 0;

    // Get reactions stats
    const { data: postsWithReactions } = await supabase
      .from("posts_history")
      .select("reactions")
      .eq("bot_service_id", serviceId)
      .in("status", ["published", "success"]);

    console.log('Posts with reactions:', postsWithReactions);
    const totalReactions = postsWithReactions?.reduce((sum, post) => sum + (post.reactions || 0), 0) || 0;
    const avgReactionsPerPost = publishedPosts ? Math.round(totalReactions / publishedPosts) : 0;
    console.log('Total reactions:', totalReactions, 'Avg per post:', avgReactionsPerPost);

    setStats({
      totalPosts: totalPosts || 0,
      publishedPosts: publishedPosts || 0,
      failedPosts: failedPosts || 0,
      pendingPosts: pendingPosts || 0,
      scheduledPosts: 0, // Plagiarist doesn't use scheduled
      todayPosts: todayPosts || 0,
      weekPosts: weekPosts || 0,
      monthPosts: monthPosts || 0,
      lastPostDate: lastPost?.created_at || null,
      avgPostsPerDay: Math.round(avgPostsPerDay * 10) / 10,
      sourcesCount: sourcesCount || 0,
      totalViews,
      avgViewsPerPost,
      totalReactions,
      avgReactionsPerPost,
    });
    
    setLastUpdated(new Date());
  };

  const loadAIStats = async () => {
    // Published posts
    const { count: publishedPosts } = await supabase
      .from("ai_generated_posts")
      .select("*", { count: 'exact', head: true })
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "published");

    // Failed posts
    const { count: failedPosts } = await supabase
      .from("ai_generated_posts")
      .select("*", { count: 'exact', head: true })
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "failed");

    // Scheduled posts (queue)
    const { count: scheduledPosts } = await supabase
      .from("ai_generated_posts")
      .select("*", { count: 'exact', head: true })
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "scheduled");

    // Pending posts (legacy)
    const { count: pendingPosts } = await supabase
      .from("ai_generated_posts")
      .select("*", { count: 'exact', head: true })
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "pending");

    // Total posts (published + failed only, excluding scheduled)
    const totalPosts = (publishedPosts || 0) + (failedPosts || 0);

    // Today posts
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: todayPosts } = await supabase
      .from("ai_generated_posts")
      .select("*", { count: 'exact', head: true })
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "published")
      .gte("created_at", today.toISOString());

    // Week posts
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const { count: weekPosts } = await supabase
      .from("ai_generated_posts")
      .select("*", { count: 'exact', head: true })
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "published")
      .gte("created_at", weekAgo.toISOString());

    // Month posts
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);
    const { count: monthPosts } = await supabase
      .from("ai_generated_posts")
      .select("*", { count: 'exact', head: true })
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "published")
      .gte("created_at", monthAgo.toISOString());

    // Last post date
    const { data: lastPost } = await supabase
      .from("ai_generated_posts")
      .select("created_at")
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "published")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    // Categories count
    const { count: sourcesCount } = await supabase
      .from("ai_content_sources")
      .select("*", { count: 'exact', head: true })
      .eq("ai_bot_service_id", serviceId)
      .eq("is_active", true);

    // Calculate average posts per day
    const { data: firstPost } = await supabase
      .from("ai_generated_posts")
      .select("created_at")
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "published")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    let avgPostsPerDay = 0;
    if (firstPost && publishedPosts) {
      const daysSinceFirst = Math.ceil((Date.now() - new Date(firstPost.created_at).getTime()) / (1000 * 60 * 60 * 24));
      avgPostsPerDay = daysSinceFirst > 0 ? publishedPosts / daysSinceFirst : 0;
    }

    // Calculate views
    const { data: postsWithViews } = await supabase
      .from("ai_generated_posts")
      .select("views")
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "published");

    const totalViews = postsWithViews?.reduce((sum, post) => sum + (post.views || 0), 0) || 0;
    const avgViewsPerPost = publishedPosts ? Math.round(totalViews / publishedPosts) : 0;

    // Get reactions stats for AI posts
    const { data: postsWithReactions } = await supabase
      .from("ai_generated_posts")
      .select("reactions")
      .eq("ai_bot_service_id", serviceId)
      .eq("status", "published");

    console.log('AI Posts with reactions:', postsWithReactions);
    const totalReactions = postsWithReactions?.reduce((sum, post) => sum + (post.reactions || 0), 0) || 0;
    const avgReactionsPerPost = publishedPosts ? Math.round(totalReactions / publishedPosts) : 0;
    console.log('Total AI reactions:', totalReactions, 'Avg per post:', avgReactionsPerPost);

    // Get top posts by views (with hybrid stats)
    setStats({
      totalPosts: totalPosts,
      publishedPosts: publishedPosts || 0,
      failedPosts: failedPosts || 0,
      pendingPosts: pendingPosts || 0,
      scheduledPosts: scheduledPosts || 0,
      todayPosts: todayPosts || 0,
      weekPosts: weekPosts || 0,
      monthPosts: monthPosts || 0,
      lastPostDate: lastPost?.created_at || null,
      avgPostsPerDay: Math.round(avgPostsPerDay * 10) / 10,
      sourcesCount: sourcesCount || 0,
      totalViews,
      avgViewsPerPost,
      totalReactions,
      avgReactionsPerPost,
    });
    
    setLastUpdated(new Date());
  };

  const handleSyncStats = async (mode: 'hybrid' | 'scraping' | 'userbot' = 'hybrid') => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-stats-scraping", {
        body: { serviceId, serviceType, mode },
      });


      if (error) {
        console.error('Sync error:', error);
        throw error;
      }

      if (!data || data.updated === undefined) {
        throw new Error('Некоректна відповідь від сервера');
      }

      console.log('Sync response data:', data);

      // Update channel info with subscribers count from sync
      if (data.subscribersCount) {
        console.log('✅ Updating channel info with subscribers:', data.subscribersCount);
        console.log('Current channelInfo before update:', channelInfo);
        
        // Force update with new object reference
        const newChannelInfo: ChannelInfo = {
          title: channelInfo?.title || channelName,
          username: channelInfo?.username || channelName,
          type: channelInfo?.type || 'Канал',
          membersCount: data.subscribersCount,
          photo: channelInfo?.photo,
          description: channelInfo?.description,
          isPrivate: channelInfo?.isPrivate,
        };
        
        console.log('New channelInfo object:', newChannelInfo);
        setChannelInfo(newChannelInfo);
        
        // Verify update after small delay
        setTimeout(() => {
          console.log('Channel info after setState (should have membersCount)');
        }, 100);
      } else {
        console.log('❌ No subscribersCount in response, data:', data);
      }

      toast({
        title: data.updated > 0 ? "Статистика оновлена" : "Статистика актуальна",
        description: data.updated > 0 
          ? `Оновлено ${data.updated} з ${data.total} постів${data.subscribersCount ? ` • ${data.subscribersCount.toLocaleString()} підписників` : ''}`
          : `Перевірено ${data.total} постів. Немає змін.${data.subscribersCount ? ` • ${data.subscribersCount.toLocaleString()} підписників` : ''}`,
      });

      // Reload stats immediately after sync (don't wait for real-time)
      // Add small delay to ensure DB updates are propagated
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadStats();
    } catch (error: any) {
      console.error("Error syncing stats:", error);
      
      let errorMessage = "Не вдалося оновити статистику";
      
      if (error.message?.includes('Channel username')) {
        errorMessage = "Не вказано username каналу (@channel_name) в налаштуваннях бота";
      } else if (error.message?.includes('not found')) {
        errorMessage = "Канал не знайдено або бот не має доступу";
      }
      
      toast({
        title: "Помилка синхронізації",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  if (isLoading) return <Loading />;

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <PageHeader
          icon={BarChart3}
          title={`Статистика: ${channelInfo?.title || channelName}`}
          description={`Детальна аналітика публікацій та активності каналу @${channelInfo?.username || channelName}`}
          backTo="/my-channels"
          backLabel="Назад до каналів"
        >
          <div className="flex items-center gap-4 mt-4">
            {isSyncing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Оновлення статистики...</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>Останнє оновлення: {lastUpdated.toLocaleString("uk-UA", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              })}</span>
            </div>
          </div>
        </PageHeader>
        
        <div className="mb-6">
          {/* Channel Info Badge */}
          <Card className="glass-effect mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Badge variant="outline" className="flex-shrink-0">
                  {serviceType === 'ai' ? (
                    <>
                      <Sparkles className="w-3 h-3 mr-1" />
                      AI Бот
                    </>
                  ) : (
                    <>
                      <Bot className="w-3 h-3 mr-1" />
                      Плагіатор
                    </>
                  )}
                </Badge>
                
                {channelInfo?.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {channelInfo.description}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{channelInfo?.type || 'Канал'}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5">
                      {channelInfo?.isPrivate ? (
                        <>
                          <Lock className="w-4 h-4 text-amber-500" />
                          <span className="text-muted-foreground">Приватний</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-4 h-4 text-green-500" />
                          <span className="text-muted-foreground">Публічний</span>
                        </>
                      )}
                    </div>
                    {channelInfo?.membersCount !== undefined && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Users className="w-4 h-4" />
                        <span className="font-semibold">{channelInfo.membersCount.toLocaleString()}</span>
                      <span>підписників</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {stats && (
          <>
            {/* Tabs for filtering */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-4">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="all">Всі</TabsTrigger>
                <TabsTrigger value="subscribers">Підписники</TabsTrigger>
                <TabsTrigger value="views">Перегляди</TabsTrigger>
                <TabsTrigger value="reactions">Реакції</TabsTrigger>
              </TabsList>
            </Tabs>
            
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Total Views */}
            {shouldShowCard('views') && (
            <Card className="glass-effect">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                    <Eye className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-bold">{stats.totalViews.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground truncate">Переглядів</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Average Views */}
            {shouldShowCard('views') && (
            <Card className="glass-effect">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                    <Eye className="w-4 h-4 text-pink-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-bold">{stats.avgViewsPerPost.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground truncate">Середньо/пост</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Total Reactions */}
            {shouldShowCard('reactions') && (
            <Card className="glass-effect">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-4 h-4 text-rose-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-bold text-rose-500">{stats.totalReactions.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground truncate">Реакцій</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Average Reactions Per Post */}
            {shouldShowCard('reactions') && (
            <Card className="glass-effect">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                    <Heart className="w-4 h-4 text-red-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xl font-bold">{stats.avgReactionsPerPost.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground truncate">Реакцій/пост</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            )}

            {/* Subscribers Today */}
            {shouldShowCard('subscribers') && channelInfo?.subscribersToday !== undefined && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-green-500">
                        {channelInfo.subscribersToday > 0 ? '+' : ''}{channelInfo.subscribersToday.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Підписників/день</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Subscribers Week */}
            {shouldShowCard('subscribers') && channelInfo?.subscribersWeek !== undefined && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-emerald-500">
                        {channelInfo.subscribersWeek > 0 ? '+' : ''}{channelInfo.subscribersWeek.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Підписників/тиждень</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Subscribers Month */}
            {shouldShowCard('subscribers') && channelInfo?.subscribersMonth !== undefined && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-teal-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-teal-500">
                        {channelInfo.subscribersMonth > 0 ? '+' : ''}{channelInfo.subscribersMonth.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Підписників/місяць</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Views Today */}
            {shouldShowCard('views') && channelInfo?.viewsToday !== undefined && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Eye className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-blue-500">
                        {channelInfo.viewsToday > 0 ? '+' : ''}{channelInfo.viewsToday.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Переглядів/день</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Views Week */}
            {shouldShowCard('views') && channelInfo?.viewsWeek !== undefined && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                      <Eye className="w-4 h-4 text-sky-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-sky-500">
                        {channelInfo.viewsWeek > 0 ? '+' : ''}{channelInfo.viewsWeek.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Переглядів/тиждень</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Views Month */}
            {shouldShowCard('views') && channelInfo?.viewsMonth !== undefined && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      <Eye className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-cyan-500">
                        {channelInfo.viewsMonth > 0 ? '+' : ''}{channelInfo.viewsMonth.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Переглядів/місяць</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Reactions Today */}
            {shouldShowCard('reactions') && channelInfo?.reactionsToday !== undefined && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-4 h-4 text-pink-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-pink-500">
                        {channelInfo.reactionsToday > 0 ? '+' : ''}{channelInfo.reactionsToday.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Реакцій/день</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Reactions Week */}
            {shouldShowCard('reactions') && channelInfo?.reactionsWeek !== undefined && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-rose-500">
                        {channelInfo.reactionsWeek > 0 ? '+' : ''}{channelInfo.reactionsWeek.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Реакцій/тиждень</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Reactions Month */}
            {shouldShowCard('reactions') && channelInfo?.reactionsMonth !== undefined && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-red-500">
                        {channelInfo.reactionsMonth > 0 ? '+' : ''}{channelInfo.reactionsMonth.toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Реакцій/місяць</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          </>
        )}
      </main>
    </div>
  );
}

