import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { 
  MessageSquare, 
  Calendar,
  Award,
  Trash2,
  AlertTriangle,
  BarChart3,
  CheckCircle,
  Clock,
  TrendingUp
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
import { StatsDisplay } from "@/components/StatsDisplay";

// Copied from ChannelStats.tsx (lines 69-78)
interface TopPost {
  id: string;
  content: string;
  views: number;
  reactions: number;
  created_at: string;
  message_id?: number;
  scraping_stats?: any;
  mtproto_stats?: any;
}

export default function ChannelPosts() {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const { serviceId, serviceType, channelName } = location.state || {};
  
  // Copied from ChannelStats.tsx (lines 107-109)
  const [isLoading, setIsLoading] = useState(true);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteDays, setDeleteDays] = useState<3 | 7 | 30>(3);
  
  // Additional states for posts statistics
  const [publishedPosts, setPublishedPosts] = useState(0);
  const [scheduledPosts, setScheduledPosts] = useState(0);
  const [todayPosts, setTodayPosts] = useState(0);
  const [weekPosts, setWeekPosts] = useState(0);
  const [monthPosts, setMonthPosts] = useState(0);
  const [lastPostDate, setLastPostDate] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId || !serviceType) {
      navigate("/my-channels");
      return;
    }
    loadAllData();
  }, [serviceId, serviceType]);

  const loadAllData = async () => {
    setIsLoading(true);
    await Promise.all([
      loadTopPosts(),
      loadStats()
    ]);
    setIsLoading(false);
  };

  // Copied from ChannelStats.tsx (lines 474-498 for plagiarist, 639-648 for ai)
  const loadTopPosts = async () => {
    try {
      if (serviceType === 'plagiarist') {
        // For plagiarist bots - load all published posts and sort by views
        const { data, error } = await supabase
          .from("posts_history")
          .select("*")
          .eq("bot_service_id", serviceId)
          .eq("status", "published")
          .order("created_at", { ascending: false })
          .limit(20);

        if (error) throw error;

        // Sort by views and take top 5
        const sorted = (data || [])
          .sort((a, b) => {
            const aViews = a.scraping_stats?.views || a.mtproto_stats?.views || 0;
            const bViews = b.scraping_stats?.views || b.mtproto_stats?.views || 0;
            return bViews - aViews;
          })
          .slice(0, 5);

        setTopPosts(sorted);
      } else {
        // For AI bots - load top 5 directly from database
        const { data, error } = await supabase
          .from("ai_generated_posts")
          .select("*")
          .eq("ai_bot_service_id", serviceId)
          .eq("status", "published")
          .order("views", { ascending: false })
          .limit(5);

        if (error) throw error;
        setTopPosts(data || []);
      }
    } catch (error) {
      console.error("Error loading top posts:", error);
    }
  };

  const loadStats = async () => {
    try {
      const table = serviceType === 'plagiarist' ? 'posts_history' : 'ai_generated_posts';
      const idField = serviceType === 'plagiarist' ? 'bot_service_id' : 'ai_bot_service_id';
      
      // Count published posts
      const { count: published, error: publishedError } = await (supabase as any)
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(idField, serviceId)
        .eq('status', 'published');

      if (publishedError) throw publishedError;
      setPublishedPosts(published || 0);

      // Count today posts (Copied from ChannelStats.tsx logic)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: today_count } = await (supabase as any)
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(idField, serviceId)
        .eq('status', 'published')
        .gte('created_at', today.toISOString());
      setTodayPosts(today_count || 0);

      // Count week posts
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: week_count } = await (supabase as any)
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(idField, serviceId)
        .eq('status', 'published')
        .gte('created_at', weekAgo.toISOString());
      setWeekPosts(week_count || 0);

      // Count month posts
      const monthAgo = new Date();
      monthAgo.setDate(monthAgo.getDate() - 30);
      const { count: month_count } = await (supabase as any)
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq(idField, serviceId)
        .eq('status', 'published')
        .gte('created_at', monthAgo.toISOString());
      setMonthPosts(month_count || 0);

      // Get last post date
      const { data: lastPost } = await (supabase as any)
        .from(table)
        .select('created_at')
        .eq(idField, serviceId)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      setLastPostDate(lastPost?.created_at || null);

      // Count scheduled posts (only for AI bots)
      if (serviceType === 'ai') {
        const { count: scheduled, error: scheduledError } = await (supabase as any)
          .from(table)
          .select('*', { count: 'exact', head: true })
          .eq(idField, serviceId)
          .eq('status', 'scheduled');

        if (scheduledError) throw scheduledError;
        setScheduledPosts(scheduled || 0);
      }
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  // Copied from ChannelStats.tsx (lines 750-780)
  const handleDeletePosts = async () => {
    try {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - deleteDays);
      
      const table = serviceType === 'plagiarist' ? 'posts_history' : 'ai_generated_posts';
      const idField = serviceType === 'plagiarist' ? 'bot_service_id' : 'ai_bot_service_id';
      
      const { error, count } = await (supabase as any)
        .from(table as any)
        .delete({ count: 'exact' })
        .eq(idField, serviceId)
        .lte('created_at', dateLimit.toISOString());

      if (error) throw error;

      toast({
        title: "Історія очищена",
        description: `Видалено ${count || 0} постів старіших за ${deleteDays} ${deleteDays === 3 ? 'дні' : deleteDays === 7 ? 'днів' : 'днів'}`,
      });

      setDeleteDialogOpen(false);
      loadAllData(); // Reload all data
    } catch (error: any) {
      console.error("Error deleting posts:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося очистити історію",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <Loading />;

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <PageHeader
          icon={MessageSquare}
          title={`Публікації: ${channelName}`}
          description={`Всі публікації каналу @${channelName}`}
          backTo="/my-channels"
          backLabel="Назад до каналів"
        >
          <div className="flex items-center gap-2 mt-4">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => navigate("/channel-stats", { 
                state: { 
                  serviceId, 
                  serviceType, 
                  channelName
                } 
              })}
            >
              <BarChart3 className="w-3 h-3 mr-1" />
              Статистика
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Очистити історію
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => { setDeleteDays(3); setDeleteDialogOpen(true); }}>
                  Очистити за 3 дні
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDeleteDays(7); setDeleteDialogOpen(true); }}>
                  Очистити за 7 днів
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => { setDeleteDays(30); setDeleteDialogOpen(true); }}>
                  Очистити за 30 днів
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </PageHeader>

        {/* Published and Scheduled Stats - Copied from ChannelStats.tsx (lines 900-979) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
          {/* Published Posts */}
          <Card className="glass-effect">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="w-5 h-5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-2xl font-bold text-success">{publishedPosts}</div>
                  <p className="text-sm text-muted-foreground truncate">Опубліковано постів</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => navigate("/all-posts", { 
                    state: { 
                      serviceId, 
                      serviceType, 
                      channelName
                    } 
                  })}
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Переглянути
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Scheduled Posts (AI only) - Copied from ChannelStats.tsx (lines 951-979) */}
          {serviceType === 'ai' && (
            <Card className="glass-effect">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-2xl font-bold text-amber-500">{scheduledPosts}/10</div>
                    <p className="text-sm text-muted-foreground truncate">В черзі на публікацію</p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate("/queue-management", { 
                      state: { 
                        serviceId, 
                        serviceType, 
                        channelName
                      } 
                    })}
                  >
                    <Clock className="w-3 h-3 mr-1" />
                    Керувати
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Today/Week/Month/Last Post Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
          {/* Today Posts */}
          <Card className="glass-effect">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-4 h-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-bold text-primary">{todayPosts}</div>
                  <p className="text-xs text-muted-foreground truncate">Сьогодні</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Week Posts */}
          <Card className="glass-effect">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-bold">{weekPosts}</div>
                  <p className="text-xs text-muted-foreground truncate">За тиждень</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Month Posts */}
          <Card className="glass-effect">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xl font-bold">{monthPosts}</div>
                  <p className="text-xs text-muted-foreground truncate">За місяць</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Last Post - Copied from ChannelStats.tsx (lines 979-1004) */}
          <Card className="glass-effect col-span-2">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold truncate">
                    {lastPostDate 
                      ? new Date(lastPostDate).toLocaleString("uk-UA", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "Немає постів"
                    }
                  </div>
                  <p className="text-xs text-muted-foreground truncate">Останній пост</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top Posts Section - Copied from ChannelStats.tsx (lines 1354-1406) */}
        {topPosts.length > 0 && (
          <div id="top-posts-section" className="mt-8">
            <Card className="glass-effect">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="w-5 h-5 text-primary" />
                  Топ-5 публікацій за переглядами
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {topPosts.map((post, index) => (
                    <div 
                      key={index}
                      className="p-4 rounded-lg bg-accent/50 border border-border/30 hover:bg-accent/70 transition-colors"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg ${
                            index === 0 ? 'bg-yellow-500/20 text-yellow-500' :
                            index === 1 ? 'bg-gray-400/20 text-gray-400' :
                            index === 2 ? 'bg-orange-600/20 text-orange-600' :
                            'bg-primary/10 text-primary'
                          }`}>
                            {index + 1}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground mb-2 line-clamp-3">
                            {post.content}
                          </p>
                          <div className="space-y-2">
                            <StatsDisplay post={post} showDetails={false} />
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>
                                {new Date(post.created_at).toLocaleDateString("uk-UA", {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                })}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>

      {/* Delete Confirmation Dialog - Copied from ChannelStats.tsx (lines 1411-1445) */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Підтвердіть очищення історії
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                Ви збираєтеся видалити всі пости старіші за <strong>{deleteDays} {deleteDays === 3 ? 'дні' : 'днів'}</strong> з історії в додатку.
              </p>
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                <p className="text-sm text-amber-600 dark:text-amber-500 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>
                    <strong>Важливо:</strong> Пости будуть видалені тільки з історії в додатку. 
                    В Telegram каналі вони залишаться без змін.
                  </span>
                </p>
              </div>
              <p className="text-sm">Цю дію неможливо скасувати.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeletePosts}
              className="bg-destructive hover:bg-destructive/90"
            >
              Так, очистити історію
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
