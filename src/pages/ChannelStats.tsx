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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip as RechartsTooltip, 
  ResponsiveContainer 
} from "recharts";

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
  
  // Timeline data for charts
  const [viewsTimeline, setViewsTimeline] = useState<Array<{ date: string; count: number }>>([]);
  const [reactionsTimeline, setReactionsTimeline] = useState<Array<{ date: string; count: number }>>([]);
  const [subscribersTimeline, setSubscribersTimeline] = useState<Array<{ date: string; count: number }>>([]);
  const [timelineRange, setTimelineRange] = useState<'7d' | '14d' | '30d' | 'all'>('30d');

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

  useEffect(() => {
    if (serviceId && serviceType) {
      loadTimelines();
    }
  }, [timelineRange]);

  const loadTimelines = async () => {
    try {
      const daysAgo = timelineRange === '7d' ? 7 : timelineRange === '14d' ? 14 : timelineRange === '30d' ? 30 : 365;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysAgo);

      const { data: history } = await (supabase
        .from('channel_stats_history' as any)
        .select('recorded_at, subscribers_count, total_views, total_reactions')
        .eq('service_id', serviceId)
        .eq('service_type', serviceType)
        .gte('recorded_at', startDate.toISOString())
        .order('recorded_at', { ascending: true }) as any);

      if (history) {
        // Views timeline
        const viewsData = history.map((h: any) => ({
          date: new Date(h.recorded_at).toLocaleDateString('uk-UA'),
          count: h.total_views || 0
        }));
        setViewsTimeline(viewsData);

        // Reactions timeline
        const reactionsData = history.map((h: any) => ({
          date: new Date(h.recorded_at).toLocaleDateString('uk-UA'),
          count: h.total_reactions || 0
        }));
        setReactionsTimeline(reactionsData);

        // Subscribers timeline - показуємо ЗМІНУ (різницю між днями)
        const subsData: Array<{ date: string; count: number }> = [];
        for (let i = 0; i < history.length; i++) {
          const current = history[i];
          const previous = i > 0 ? history[i - 1] : null;
          
          // Різниця з попереднім днем (може бути + або -)
          const change = previous 
            ? (current.subscribers_count || 0) - (previous.subscribers_count || 0)
            : 0; // Для першого запису показуємо 0
          
          subsData.push({
            date: new Date(current.recorded_at).toLocaleDateString('uk-UA'),
            count: change
          });
        }
        setSubscribersTimeline(subsData);
      }
    } catch (error) {
      console.error('Error loading timelines:', error);
    }
  };

  const loadStats = async () => {
    try {
      setIsLoading(true);
      
      // Load channel info from Telegram
      await loadChannelInfo();
      
      // Get last_stats_sync from service
      const serviceTable = serviceType === 'plagiarist' ? 'bot_services' : 'ai_bot_services';
      const { data: serviceData } = await supabase
        .from(serviceTable)
        .select('last_stats_sync')
        .eq('id', serviceId)
        .single();
      
      if (serviceData?.last_stats_sync) {
        setLastUpdated(new Date(serviceData.last_stats_sync));
      }
      
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
        
        if (membersCount) {
          // Рахуємо ПОСТИ за періоди на основі created_at
          const postsTable = serviceType === 'plagiarist' ? 'posts_history' : 'ai_generated_posts';
          const idField = serviceType === 'plagiarist' ? 'bot_service_id' : 'ai_bot_service_id';
          
          // За сьогодні (від 00:00)
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const { data: todayPosts } = await supabase
            .from(postsTable)
            .select('views, reactions')
            .eq(idField, serviceId)
            .in('status', ['published', 'success'])
            .gte('created_at', today.toISOString());
          
          if (todayPosts) {
            viewsToday = todayPosts.reduce((sum, p) => sum + (p.views || 0), 0);
            reactionsToday = todayPosts.reduce((sum, p) => sum + (p.reactions || 0), 0);
          }
          
          // За тиждень (останні 7 днів)
          const weekAgo = new Date();
          weekAgo.setDate(weekAgo.getDate() - 7);
          weekAgo.setHours(0, 0, 0, 0);
          const { data: weekPosts } = await supabase
            .from(postsTable)
            .select('views, reactions')
            .eq(idField, serviceId)
            .in('status', ['published', 'success'])
            .gte('created_at', weekAgo.toISOString());
          
          if (weekPosts) {
            viewsWeek = weekPosts.reduce((sum, p) => sum + (p.views || 0), 0);
            reactionsWeek = weekPosts.reduce((sum, p) => sum + (p.reactions || 0), 0);
          }
          
          // За місяць (останні 30 днів)
          const monthAgo = new Date();
          monthAgo.setDate(monthAgo.getDate() - 30);
          monthAgo.setHours(0, 0, 0, 0);
          const { data: monthPosts } = await supabase
            .from(postsTable)
            .select('views, reactions')
            .eq(idField, serviceId)
            .in('status', ['published', 'success'])
            .gte('created_at', monthAgo.toISOString());
          
          if (monthPosts) {
            viewsMonth = monthPosts.reduce((sum, p) => sum + (p.views || 0), 0);
            reactionsMonth = monthPosts.reduce((sum, p) => sum + (p.reactions || 0), 0);
          }
          
          // Рахуємо ПІДПИСНИКІВ через історію (різниця)
          // За сьогодні - берем найстарішу запис ДО сьогодні (вчора або раніше)
          const { data: todayHistory } = await supabase
            .from('channel_stats_history')
            .select('subscribers_count')
            .eq('service_id', serviceId)
            .eq('service_type', serviceType)
            .lt('recorded_at', today.toISOString())
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (todayHistory) {
            // Рахуємо різницю (може бути + або -)
            subscribersToday = membersCount - (todayHistory.subscribers_count || 0);
          } else {
            // Якщо немає історії - 0 (не показуємо зміну)
            subscribersToday = 0;
          }
          
          // За тиждень - берем запис 7 днів тому або раніше
          const { data: weekHistory } = await supabase
            .from('channel_stats_history')
            .select('subscribers_count')
            .eq('service_id', serviceId)
            .eq('service_type', serviceType)
            .lt('recorded_at', weekAgo.toISOString())
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (weekHistory) {
            subscribersWeek = membersCount - (weekHistory.subscribers_count || 0);
          } else {
            subscribersWeek = 0;
          }
          
          // За місяць - берем запис 30 днів тому або раніше
          const { data: monthHistory } = await supabase
            .from('channel_stats_history')
            .select('subscribers_count')
            .eq('service_id', serviceId)
            .eq('service_type', serviceType)
            .lt('recorded_at', monthAgo.toISOString())
            .order('recorded_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          if (monthHistory) {
            subscribersMonth = membersCount - (monthHistory.subscribers_count || 0);
          } else {
            subscribersMonth = 0;
          }
        }
        
        // Save to channel_stats_history (оновлюємо сьогоднішній запис або створюємо новий)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        const { data: existingRecord } = await supabase
          .from('channel_stats_history')
          .select('id')
          .eq('service_id', serviceId)
          .eq('service_type', serviceType)
          .gte('recorded_at', today.toISOString())
          .lt('recorded_at', tomorrow.toISOString())
          .maybeSingle();
        
        const currentTime = new Date().toISOString();
        
        if (existingRecord) {
          // Оновлюємо існуючий запис
          await supabase
            .from('channel_stats_history')
            .update({
              subscribers_count: membersCount,
              total_views: stats?.totalViews || 0,
              total_reactions: stats?.totalReactions || 0,
              recorded_at: currentTime
            })
            .eq('id', existingRecord.id);
          
          setLastUpdated(new Date(currentTime));
        } else {
          // Створюємо новий запис
          const { data: insertResult } = await supabase
            .from('channel_stats_history')
            .insert({
              service_id: serviceId,
              service_type: serviceType,
              channel_name: channelName,
              subscribers_count: membersCount,
              total_views: stats?.totalViews || 0,
              total_reactions: stats?.totalReactions || 0,
              recorded_at: currentTime
            })
            .select('recorded_at')
            .single();
          
          if (insertResult) {
            setLastUpdated(new Date(insertResult.recorded_at));
          }
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

    // Calculate views (from MTProto stats only)
    const { data: postsWithViewStats } = await supabase
      .from("posts_history")
      .select("mtproto_stats, views")
      .eq("bot_service_id", serviceId)
      .in("status", ["published", "success"]);

    const totalViews = (postsWithViewStats || []).reduce((sum, post: any) => {
      const mtprotoViews = post.mtproto_stats?.views ?? 0;
      const directViews = post.views ?? 0;
      return sum + Math.max(mtprotoViews, directViews);
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
    
    // Get last update time from history table
    const { data: lastHistory } = await supabase
      .from('channel_stats_history' as any)
      .select('recorded_at')
      .eq('service_id', serviceId)
      .eq('service_type', serviceType)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (lastHistory) {
      setLastUpdated(new Date(lastHistory.recorded_at));
    }
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

    // Get top posts by views (MTProto stats)
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
    
    // Get last update time from history table
    const { data: lastHistory } = await supabase
      .from('channel_stats_history' as any)
      .select('recorded_at')
      .eq('ai_bot_service_id', serviceId)
      .eq('service_type', serviceType)
      .order('recorded_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (lastHistory) {
      setLastUpdated(new Date(lastHistory.recorded_at));
    }
  };

  const handleSyncStats = async () => {
    setIsSyncing(true);
    try {
      // Get spy_id from service
      const table = serviceType === 'plagiarist' ? 'bot_services' : 'ai_bot_services';
      const { data: service } = await supabase
        .from(table)
        .select('spy_id')
        .eq('id', serviceId)
        .single();

      if (!service?.spy_id) {
        throw new Error('Юзербот не підключений до каналу');
      }

      // Call MTProto sync only
      const { data, error } = await supabase.functions.invoke("sync-stats-userbot", {
        body: { 
          serviceId, 
          serviceType,
          spyId: service.spy_id
        },
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
        {/* Channel Header with Avatar */}
        <div className="mb-6">
          <Card className="glass-effect">
            <CardContent className="p-6">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate("/my-channels")}
                className="mb-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Назад до каналів
              </Button>
              
              <div className="flex items-start gap-4">
                {/* Avatar */}
                <div className="flex-shrink-0">
                  {channelInfo?.photo ? (
                    <img 
                      src={channelInfo.photo} 
                      alt={channelInfo.title}
                      className="w-20 h-20 rounded-full object-cover border-2 border-border"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="w-10 h-10 text-primary" />
                    </div>
                  )}
                </div>
                
                {/* Channel Info */}
                <div className="flex-1 min-w-0">
                  {/* Title */}
                  <h1 className="text-2xl font-bold mb-1 truncate">
                    {channelInfo?.title || channelName}
                  </h1>
                  
                  {/* Username & Status */}
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-muted-foreground">
                      @{channelInfo?.username || channelName}
                    </span>
                    <Badge variant={channelInfo?.isPrivate ? "secondary" : "default"}>
                      {channelInfo?.isPrivate ? (
                        <>
                          <Lock className="w-3 h-3 mr-1" />
                          Приватний
                        </>
                      ) : (
                        <>
                          <Globe className="w-3 h-3 mr-1" />
                          Публічний
                        </>
                      )}
                    </Badge>
                    <Badge variant="outline" className="flex-shrink-0">
                      {serviceType === 'ai' ? (
                        <>
                          <Sparkles className="w-3 h-3 mr-1" />
                          AI Бот
                        </>
                      ) : (
                        <>
                          <Bot className="w-3 h-3 mr-1" />
                          Плагіат-бот
                        </>
                      )}
                    </Badge>
                    {channelInfo?.membersCount && (
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30 flex-shrink-0">
                        <Users className="w-3 h-3 mr-1" />
                        {channelInfo.membersCount.toLocaleString()} підписників
                      </Badge>
                    )}
                  </div>
                  
                  {/* Subtitle */}
                  <h2 className="text-lg font-semibold mb-3">Статистика каналу</h2>
                  
                  {/* Last Update & Sync Status */}
                  <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-4 flex-wrap">
                      {isSyncing && (
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Оновлення...</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        <span>
                          Оновлено: {lastUpdated.toLocaleString("uk-UA", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <span className="text-xs">• Автооновлення кожні 10 хв</span>
                    </div>
                    <div className="text-xs opacity-80">
                      ℹ️ Дані збираються з моменту додавання каналу, лише з опублікованих ботом постів
                    </div>
                  </div>
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
            {shouldShowCard('subscribers') && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xl font-bold ${
                        (channelInfo?.subscribersToday || 0) > 0 ? 'text-green-500' : 
                        (channelInfo?.subscribersToday || 0) < 0 ? 'text-red-500' : 
                        'text-muted-foreground'
                      }`}>
                        {(channelInfo?.subscribersToday || 0) > 0 ? '+' : ''}{(channelInfo?.subscribersToday || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Підписників/день</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Subscribers Week */}
            {shouldShowCard('subscribers') && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xl font-bold ${
                        (channelInfo?.subscribersWeek || 0) > 0 ? 'text-emerald-500' : 
                        (channelInfo?.subscribersWeek || 0) < 0 ? 'text-red-500' : 
                        'text-muted-foreground'
                      }`}>
                        {(channelInfo?.subscribersWeek || 0) > 0 ? '+' : ''}{(channelInfo?.subscribersWeek || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Підписників/тиждень</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Subscribers Month */}
            {shouldShowCard('subscribers') && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-teal-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={`text-xl font-bold ${
                        (channelInfo?.subscribersMonth || 0) > 0 ? 'text-teal-500' : 
                        (channelInfo?.subscribersMonth || 0) < 0 ? 'text-red-500' : 
                        'text-muted-foreground'
                      }`}>
                        {(channelInfo?.subscribersMonth || 0) > 0 ? '+' : ''}{(channelInfo?.subscribersMonth || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Підписників/місяць</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Views Today */}
            {shouldShowCard('views') && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                      <Eye className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-blue-500">
                        {(channelInfo?.viewsToday || 0) > 0 ? '+' : ''}{(channelInfo?.viewsToday || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Переглядів/день</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Views Week */}
            {shouldShowCard('views') && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center flex-shrink-0">
                      <Eye className="w-4 h-4 text-sky-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-sky-500">
                        {(channelInfo?.viewsWeek || 0) > 0 ? '+' : ''}{(channelInfo?.viewsWeek || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Переглядів/тиждень</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Views Month */}
            {shouldShowCard('views') && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center flex-shrink-0">
                      <Eye className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-cyan-500">
                        {(channelInfo?.viewsMonth || 0) > 0 ? '+' : ''}{(channelInfo?.viewsMonth || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Переглядів/місяць</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Reactions Today */}
            {shouldShowCard('reactions') && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-pink-500/10 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-4 h-4 text-pink-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-pink-500">
                        {(channelInfo?.reactionsToday || 0) > 0 ? '+' : ''}{(channelInfo?.reactionsToday || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Реакцій/день</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Reactions Week */}
            {shouldShowCard('reactions') && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-4 h-4 text-rose-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-rose-500">
                        {(channelInfo?.reactionsWeek || 0) > 0 ? '+' : ''}{(channelInfo?.reactionsWeek || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Реакцій/тиждень</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
            
            {/* Reactions Month */}
            {shouldShowCard('reactions') && (
              <Card className="glass-effect">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xl font-bold text-red-500">
                        {(channelInfo?.reactionsMonth || 0) > 0 ? '+' : ''}{(channelInfo?.reactionsMonth || 0).toLocaleString()}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">Реакцій/місяць</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Timeline Charts */}
          <div className="mt-8 space-y-6">
            {/* Views Chart */}
            {(activeTab === 'all' || activeTab === 'views') && (
              <Card className="glass-effect">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Eye className="w-5 h-5 text-primary" />
                      <CardTitle>Динаміка Переглядів</CardTitle>
                    </div>
                    <Select value={timelineRange} onValueChange={(value: any) => setTimelineRange(value)}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">7 днів</SelectItem>
                        <SelectItem value="14d">14 днів</SelectItem>
                        <SelectItem value="30d">30 днів</SelectItem>
                        <SelectItem value="all">Весь час</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {viewsTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={viewsTimeline}>
                        <defs>
                          <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.3} />
                        <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                        <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: '1px solid #6366f1', borderRadius: '8px', color: '#fff' }}
                          formatter={(value: any) => [`${value}`, 'Переглядів']}
                        />
                        <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={3} fill="url(#colorViews)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">Немає даних</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Reactions Chart */}
            {(activeTab === 'all' || activeTab === 'reactions') && (
              <Card className="glass-effect">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Heart className="w-5 h-5 text-rose-500" />
                      <CardTitle>Динаміка Реакцій</CardTitle>
                    </div>
                    <Select value={timelineRange} onValueChange={(value: any) => setTimelineRange(value)}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">7 днів</SelectItem>
                        <SelectItem value="14d">14 днів</SelectItem>
                        <SelectItem value="30d">30 днів</SelectItem>
                        <SelectItem value="all">Весь час</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {reactionsTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={reactionsTimeline}>
                        <defs>
                          <linearGradient id="colorReactions" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.3} />
                        <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                        <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: '1px solid #f43f5e', borderRadius: '8px', color: '#fff' }}
                          formatter={(value: any) => [`${value}`, 'Реакцій']}
                        />
                        <Area type="monotone" dataKey="count" stroke="#f43f5e" strokeWidth={3} fill="url(#colorReactions)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">Немає даних</div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Subscribers Chart */}
            {(activeTab === 'all' || activeTab === 'subscribers') && (
              <Card className="glass-effect">
                <CardHeader>
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-500" />
                      <CardTitle>Динаміка Підписників</CardTitle>
                    </div>
                    <Select value={timelineRange} onValueChange={(value: any) => setTimelineRange(value)}>
                      <SelectTrigger className="w-[130px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7d">7 днів</SelectItem>
                        <SelectItem value="14d">14 днів</SelectItem>
                        <SelectItem value="30d">30 днів</SelectItem>
                        <SelectItem value="all">Весь час</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardHeader>
                <CardContent>
                  {subscribersTimeline.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={subscribersTimeline}>
                        <defs>
                          <linearGradient id="colorSubscribers" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.1}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#444" opacity={0.3} />
                        <XAxis dataKey="date" stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                        <YAxis stroke="#888" tick={{ fill: '#888', fontSize: 12 }} />
                        <RechartsTooltip 
                          contentStyle={{ backgroundColor: 'rgba(0, 0, 0, 0.8)', border: '1px solid #10b981', borderRadius: '8px', color: '#fff' }}
                          formatter={(value: any) => [`${value}`, 'Підписників']}
                        />
                        <Area type="monotone" dataKey="count" stroke="#10b981" strokeWidth={3} fill="url(#colorSubscribers)" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[300px] flex items-center justify-center text-muted-foreground">Немає даних</div>
                  )}
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

