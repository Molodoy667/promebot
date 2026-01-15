import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  PieChart, 
  Pie, 
  Cell,
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar
} from "recharts";
import { 
  TrendingUp, 
 
  Bot, 
  MessageSquare,
  Calendar,
  Award,
  Users,
  Activity,
  Filter,
  TrendingDown,
  Percent
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";

interface PostsStats {
  date: string;
  count: number;
}

interface EarningsStats {
  date: string;
  amount: number;
  source: string;
}

interface BotStats {
  bot_name: string;
  posts_count: number;
  channels_count: number;
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'];

const Analytics = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>('30d');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Stats
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalBots, setTotalBots] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [growthRate, setGrowthRate] = useState(0);
  
  // Charts data
  const [postsData, setPostsData] = useState<PostsStats[]>([]);
  const [postsRawData, setPostsRawData] = useState<Array<{ datetime: string }>>([]);
  const [earningsData, setEarningsData] = useState<EarningsStats[]>([]);
  const [earningsRawData, setEarningsRawData] = useState<Array<{ datetime: string; amount: number }>>([]);
  const [botsData, setBotsData] = useState<BotStats[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [hasData, setHasData] = useState(true);
  const [timelineRange, setTimelineRange] = useState<'3d' | '7d' | '14d' | '30d' | 'all'>('30d');
  const [hourFilter, setHourFilter] = useState<number | 'all'>('all');
  const [dayFilter, setDayFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  useEffect(() => {
    // Refilter data when filters change
    applyFilters();
  }, [timelineRange, hourFilter, dayFilter]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
      return;
    }
    loadAnalytics();
  };

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        console.error("Auth error:", userError);
        navigate("/auth");
        return;
      }

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      
      switch (timeRange) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(endDate.getFullYear() - 1);
          break;
      }

      // Load posts statistics (try multiple tables)
      let totalPostsCount = 0;
      let postsChartData: PostsStats[] = [];

      // Try ai_generated_posts first
      const { data: aiPosts, error: aiPostsError } = await supabase
        .from('ai_generated_posts')
        .select('created_at, status')
        .eq('status', 'published')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (!aiPostsError && aiPosts) {
        totalPostsCount += aiPosts.length;
        
        // Group by date
        const grouped = aiPosts.reduce((acc: Record<string, number>, post) => {
          const date = new Date(post.created_at).toLocaleDateString('uk-UA');
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});

        postsChartData = Object.entries(grouped).map(([date, count]) => ({
          date,
          count
        }));
      }

      // Try posts_history table
      const { data: postsHistory, error: postsError } = await supabase
        .from('posts_history')
        .select('created_at, status')
        .eq('status', 'success')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (!postsError && postsHistory) {
        totalPostsCount += postsHistory.length;
        
        // Merge with existing data
        postsHistory.forEach(post => {
          const date = new Date(post.created_at).toLocaleDateString('uk-UA');
          const existing = postsChartData.find(d => d.date === date);
          if (existing) {
            existing.count++;
          } else {
            postsChartData.push({ date, count: 1 });
          }
        });
      }

      setTotalPosts(totalPostsCount);
      
      // Store raw posts data with datetime
      const rawPosts: Array<{ datetime: string }> = [];
      if (aiPosts) {
        aiPosts.forEach(p => rawPosts.push({ datetime: p.created_at }));
      }
      if (postsHistory) {
        postsHistory.forEach(p => rawPosts.push({ datetime: p.created_at }));
      }
      setPostsRawData(rawPosts);
      
      setPostsData(postsChartData.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
      
      // Calculate growth rate
      if (postsChartData.length > 1) {
        const lastWeek = postsChartData.slice(-7).reduce((sum, d) => sum + d.count, 0);
        const prevWeek = postsChartData.slice(-14, -7).reduce((sum, d) => sum + d.count, 0);
        if (prevWeek > 0) {
          setGrowthRate(((lastWeek - prevWeek) / prevWeek) * 100);
        }
      }

      // Load earnings from miner game
      let totalEarned = 0;
      const earningsChart: EarningsStats[] = [];

      const { data: minerData, error: minerError } = await supabase
        .from('miner_game_data')
        .select('total_earned')
        .eq('user_id', user.id)
        .maybeSingle();

      if (!minerError && minerData) {
        totalEarned += minerData.total_earned || 0;
      }

      // Load transactions
      const { data: transactions, error: txError } = await supabase
        .from('transactions')
        .select('amount, type, created_at')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .in('type', ['referral_bonus', 'task_reward', 'wheel_spin', 'lottery_win']);

      if (!txError && transactions) {
        const transactionsSum = transactions.reduce((sum, t) => sum + Number(t.amount || 0), 0);
        totalEarned += transactionsSum;

        // Group by date
        const grouped: Record<string, number> = {};
        transactions.forEach(t => {
          const date = new Date(t.created_at).toLocaleDateString('uk-UA');
          grouped[date] = (grouped[date] || 0) + Number(t.amount || 0);
        });

        earningsChart.push(...Object.entries(grouped).map(([date, amount]) => ({
          date,
          amount,
          source: 'mixed'
        })));
      }

      setTotalEarnings(totalEarned);
      
      // Store raw earnings data with datetime
      const rawEarnings: Array<{ datetime: string; amount: number }> = [];
      if (transactions) {
        transactions.forEach(t => {
          rawEarnings.push({
            datetime: t.created_at,
            amount: Number(t.amount || 0)
          });
        });
      }
      setEarningsRawData(rawEarnings);
      
      setEarningsData(earningsChart);

      // Load bots stats
      const { data: bots, error: botsError } = await supabase
        .from('telegram_bots')
        .select('bot_name')
        .eq('user_id', user.id);

      if (!botsError && bots) {
        setTotalBots(bots.length);
        
        // Get stats for each bot
        const botsWithStats = await Promise.all(
          bots.map(async (bot) => {
            const { count: postsCount } = await supabase
              .from('ai_generated_posts')
              .select('*', { count: 'exact', head: true })
              .eq('ai_bot_service_id', bot.bot_name); // Adjust field name

            return {
              bot_name: bot.bot_name || 'Без імені',
              posts_count: postsCount || 0,
              channels_count: 0
            };
          })
        );
        
        setBotsData(botsWithStats);
      }

      // Load tasks stats
      const { count: tasksCount, error: tasksError } = await supabase
        .from('task_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'approved');

      if (!tasksError) {
        setTotalTasks(tasksCount || 0);
      }

      // Load categories (skip if table doesn't exist)
      try {
        const { data: categoriesData, error: catError } = await supabase
          .from('categories')
          .select('name');
        
        if (!catError && categoriesData && categoriesData.length > 0) {
          setCategories(['all', ...categoriesData.map(c => c.name)]);
        }
      } catch (err) {
        console.log('Categories table not found, skipping filter');
      }

      // Check if has any data
      setHasData(totalPostsCount > 0 || totalEarned > 0 || bots?.length > 0 || tasksCount > 0);

    } catch (error: any) {
      console.error("Error loading analytics:", error);
      toast({ 
        title: "Помилка", 
        description: error.message || "Помилка завантаження аналітики", 
        variant: "destructive" 
      });
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    // Filter posts data
    if (postsRawData.length > 0) {
      let filtered = [...postsRawData];
      
      // Hour filter
      if (hourFilter !== 'all') {
        filtered = filtered.filter(item => {
          const date = new Date(item.datetime);
          return date.getHours() === hourFilter;
        });
      }
      
      // Day filter
      if (dayFilter !== 'all') {
        filtered = filtered.filter(item => {
          const date = new Date(item.datetime);
          return date.getDay() === dayFilter;
        });
      }
      
      // Time range filter
      if (timelineRange !== 'all') {
        const now = new Date();
        const daysAgo = timelineRange === '3d' ? 3 : 
                       timelineRange === '7d' ? 7 : 
                       timelineRange === '14d' ? 14 : 30;
        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
        
        filtered = filtered.filter(item => 
          new Date(item.datetime) >= cutoffDate
        );
      }
      
      // Aggregate by date
      const aggregated: Record<string, number> = {};
      filtered.forEach(item => {
        const date = new Date(item.datetime).toLocaleDateString('uk-UA');
        aggregated[date] = (aggregated[date] || 0) + 1;
      });
      
      const result = Object.entries(aggregated)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setPostsData(result);
    }
    
    // Filter earnings data
    if (earningsRawData.length > 0) {
      let filtered = [...earningsRawData];
      
      // Hour filter
      if (hourFilter !== 'all') {
        filtered = filtered.filter(item => {
          const date = new Date(item.datetime);
          return date.getHours() === hourFilter;
        });
      }
      
      // Day filter
      if (dayFilter !== 'all') {
        filtered = filtered.filter(item => {
          const date = new Date(item.datetime);
          return date.getDay() === dayFilter;
        });
      }
      
      // Time range filter
      if (timelineRange !== 'all') {
        const now = new Date();
        const daysAgo = timelineRange === '3d' ? 3 : 
                       timelineRange === '7d' ? 7 : 
                       timelineRange === '14d' ? 14 : 30;
        const cutoffDate = new Date(now);
        cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
        
        filtered = filtered.filter(item => 
          new Date(item.datetime) >= cutoffDate
        );
      }
      
      // Aggregate by date
      const aggregated: Record<string, number> = {};
      filtered.forEach(item => {
        const date = new Date(item.datetime).toLocaleDateString('uk-UA');
        aggregated[date] = (aggregated[date] || 0) + item.amount;
      });
      
      const result = Object.entries(aggregated)
        .map(([date, amount]) => ({ date, amount, source: 'mixed' }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      
      setEarningsData(result);
    }
  };

  // Loading skeleton
  const StatsSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map(i => (
        <Card key={i} className="p-6">
          <Skeleton className="h-4 w-20 mb-4" />
          <Skeleton className="h-10 w-24" />
        </Card>
      ))}
    </div>
  );

  const ChartSkeleton = () => (
    <Card className="p-6">
      <Skeleton className="h-6 w-40 mb-4" />
      <Skeleton className="h-[300px] w-full" />
    </Card>
  );

  // Empty state
  const EmptyState = () => (
    <Card className="p-12 text-center">
      <Activity className="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" />
      <h3 className="text-xl font-semibold mb-2">Немає даних для аналітики</h3>
      <p className="text-muted-foreground mb-6">
        Почніть використовувати платформу, щоб побачити статистику
      </p>
      <div className="flex gap-4 justify-center">
        <Button onClick={() => navigate('/bot-setup')}>
          <Bot className="w-4 h-4 mr-2" />
          Створити бота
        </Button>
        <Button variant="outline" onClick={() => navigate('/dashboard')}>
          Повернутись
        </Button>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto p-4 space-y-6 pb-20">
        <PageHeader
          icon={Activity}
          title="Аналітика"
          description="Детальна статистика вашої активності та використання платформи"
        >
          <div className="flex gap-2 mt-4 flex-wrap">
            <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="w-4 h-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">Останні 7 днів</SelectItem>
                <SelectItem value="30d">Останні 30 днів</SelectItem>
                <SelectItem value="90d">Останні 90 днів</SelectItem>
                <SelectItem value="1y">Останній рік</SelectItem>
              </SelectContent>
            </Select>

            {categories.length > 0 && (
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-[180px]">
                  <Filter className="w-4 h-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Всі категорії</SelectItem>
                  {categories.filter(c => c !== 'all').map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </PageHeader>

        {loading && (
          <>
            <StatsSkeleton />
            <ChartSkeleton />
          </>
        )}

        {!loading && !hasData && <EmptyState />}

        {!loading && hasData && (
          <>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30 hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Публікацій</p>
              <p className="text-3xl font-bold mt-2">{totalPosts.toLocaleString()}</p>
              {growthRate !== 0 && (
                <div className={`flex items-center gap-1 mt-2 text-xs ${growthRate > 0 ? 'text-green-500' : 'text-red-500'}`}>
                  {growthRate > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {Math.abs(growthRate).toFixed(1)}%
                </div>
              )}
            </div>
            <MessageSquare className="w-12 h-12 text-blue-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30 hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Заробіток</p>
              <p className="text-3xl font-bold mt-2">{totalEarnings.toLocaleString()} ₴</p>
            </div>
            <span className="text-green-500 opacity-50 font-bold text-5xl">₴</span>
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Активних ботів</p>
              <p className="text-3xl font-bold mt-2">{totalBots}</p>
            </div>
            <Bot className="w-12 h-12 text-purple-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30 hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Задач виконано</p>
              <p className="text-3xl font-bold mt-2">{totalTasks}</p>
            </div>
            <Award className="w-12 h-12 text-yellow-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border-indigo-500/30 hover:scale-105 transition-transform">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Ефективність</p>
              <p className="text-3xl font-bold mt-2">
                {totalPosts > 0 ? ((totalEarnings / totalPosts) * 100).toFixed(0) : 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">балів/пост</p>
            </div>
            <Percent className="w-12 h-12 text-indigo-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="posts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="posts">Публікації</TabsTrigger>
          <TabsTrigger value="earnings">Заробіток</TabsTrigger>
          <TabsTrigger value="bots">Боти</TabsTrigger>
          <TabsTrigger value="overview">Огляд</TabsTrigger>
        </TabsList>

        {/* Posts Chart */}
        <TabsContent value="posts">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Динаміка Публікацій</h2>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Select value={timelineRange} onValueChange={(value: any) => setTimelineRange(value)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3d">3 дні</SelectItem>
                    <SelectItem value="7d">7 днів</SelectItem>
                    <SelectItem value="14d">14 днів</SelectItem>
                    <SelectItem value="30d">30 днів</SelectItem>
                    <SelectItem value="all">Весь час</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={String(dayFilter)} onValueChange={(value) => setDayFilter(value === 'all' ? 'all' : Number(value))}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="День тижня" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі дні</SelectItem>
                    <SelectItem value="1">Понеділок</SelectItem>
                    <SelectItem value="2">Вівторок</SelectItem>
                    <SelectItem value="3">Середа</SelectItem>
                    <SelectItem value="4">Четвер</SelectItem>
                    <SelectItem value="5">П'ятниця</SelectItem>
                    <SelectItem value="6">Субота</SelectItem>
                    <SelectItem value="0">Неділя</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={String(hourFilter)} onValueChange={(value) => setHourFilter(value === 'all' ? 'all' : Number(value))}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Година" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі години</SelectItem>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i}:00 - {i}:59
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {postsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <AreaChart data={postsData}>
                  <defs>
                    <linearGradient id="colorPosts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" label={{ value: 'Дата', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Кількість', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    labelFormatter={(value) => `Дата: ${value}`}
                    formatter={(value: any) => [`${value} постів`, 'Кількість']}
                  />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#6366f1" 
                    fillOpacity={1} 
                    fill="url(#colorPosts)"
                    name="Публікації"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Немає даних про публікації</p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Earnings Chart */}
        <TabsContent value="earnings">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <span className="text-primary font-bold text-xl">₴</span>
                <h2 className="text-xl font-bold">Динаміка Заробітку</h2>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Select value={timelineRange} onValueChange={(value: any) => setTimelineRange(value)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3d">3 дні</SelectItem>
                    <SelectItem value="7d">7 днів</SelectItem>
                    <SelectItem value="14d">14 днів</SelectItem>
                    <SelectItem value="30d">30 днів</SelectItem>
                    <SelectItem value="all">Весь час</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={String(dayFilter)} onValueChange={(value) => setDayFilter(value === 'all' ? 'all' : Number(value))}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="День тижня" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі дні</SelectItem>
                    <SelectItem value="1">Понеділок</SelectItem>
                    <SelectItem value="2">Вівторок</SelectItem>
                    <SelectItem value="3">Середа</SelectItem>
                    <SelectItem value="4">Четвер</SelectItem>
                    <SelectItem value="5">П'ятниця</SelectItem>
                    <SelectItem value="6">Субота</SelectItem>
                    <SelectItem value="0">Неділя</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={String(hourFilter)} onValueChange={(value) => setHourFilter(value === 'all' ? 'all' : Number(value))}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Година" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі години</SelectItem>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i}:00 - {i}:59
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {earningsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={earningsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" label={{ value: 'Дата', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Сума (₴)', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    labelFormatter={(value) => `Дата: ${value}`}
                    formatter={(value: any) => [`${value}₴`, 'Заробіток']}
                  />
                  <Legend 
                    formatter={() => 'Заробіток'}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981' }}
                    name="Заробіток"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <span className="font-bold text-6xl mx-auto mb-4 opacity-50 block">₴</span>
                  <p>Немає даних про заробіток</p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Bots Chart */}
        <TabsContent value="bots">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
              <div className="flex items-center gap-2">
                <Bot className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold">Статистика Ботів</h2>
              </div>
              
              <div className="flex gap-2 flex-wrap">
                <Select value={timelineRange} onValueChange={(value: any) => setTimelineRange(value)}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3d">3 дні</SelectItem>
                    <SelectItem value="7d">7 днів</SelectItem>
                    <SelectItem value="14d">14 днів</SelectItem>
                    <SelectItem value="30d">30 днів</SelectItem>
                    <SelectItem value="all">Весь час</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={String(dayFilter)} onValueChange={(value) => setDayFilter(value === 'all' ? 'all' : Number(value))}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="День тижня" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі дні</SelectItem>
                    <SelectItem value="1">Понеділок</SelectItem>
                    <SelectItem value="2">Вівторок</SelectItem>
                    <SelectItem value="3">Середа</SelectItem>
                    <SelectItem value="4">Четвер</SelectItem>
                    <SelectItem value="5">П'ятниця</SelectItem>
                    <SelectItem value="6">Субота</SelectItem>
                    <SelectItem value="0">Неділя</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={String(hourFilter)} onValueChange={(value) => setHourFilter(value === 'all' ? 'all' : Number(value))}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Година" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Всі години</SelectItem>
                    {Array.from({ length: 24 }, (_, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {i}:00 - {i}:59
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {botsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={botsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bot_name" label={{ value: 'Назва бота', position: 'insideBottom', offset: -5 }} />
                  <YAxis label={{ value: 'Кількість', angle: -90, position: 'insideLeft' }} />
                  <Tooltip 
                    formatter={(value: any, name: string) => {
                      const label = name === 'posts_count' ? 'Постів' : 'Каналів';
                      return [`${value}`, label];
                    }}
                  />
                  <Legend 
                    formatter={(value) => value === 'posts_count' ? 'Постів' : 'Каналів'}
                  />
                  <Bar dataKey="posts_count" fill="#6366f1" name="Постів" />
                  <Bar dataKey="channels_count" fill="#8b5cf6" name="Каналів" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <Bot className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Немає активних ботів</p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Overview Radar Chart */}
        <TabsContent value="overview">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Загальний Огляд</h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <ResponsiveContainer width="100%" height={400}>
                <RadarChart data={[
                  { metric: 'Публікації', value: Math.min(totalPosts, 100) },
                  { metric: 'Заробіток', value: Math.min(totalEarnings / 10, 100) },
                  { metric: 'Боти', value: totalBots * 10 },
                  { metric: 'Задачі', value: totalTasks * 5 },
                  { metric: 'Активність', value: Math.min(growthRate + 50, 100) }
                ]}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar 
                    name="Показник" 
                    dataKey="value" 
                    stroke="#6366f1" 
                    fill="#6366f1" 
                    fillOpacity={0.6} 
                  />
                  <Tooltip 
                    formatter={(value: any) => [`${value}%`, 'Показник']}
                  />
                </RadarChart>
              </ResponsiveContainer>

              <div className="space-y-4">
                <h3 className="font-semibold text-lg mb-4">Ключові показники</h3>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-blue-500/10">
                    <span className="text-sm">Середня активність</span>
                    <span className="font-bold">{totalPosts > 0 ? (totalPosts / Math.max(postsData.length, 1)).toFixed(1) : 0} постів/день</span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg bg-green-500/10">
                    <span className="text-sm">Дохід на бота</span>
                    <span className="font-bold">{totalBots > 0 ? (totalEarnings / totalBots).toFixed(0) : 0} ₴</span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg bg-purple-500/10">
                    <span className="text-sm">Конверсія задач</span>
                    <span className="font-bold">{totalTasks > 0 ? ((totalTasks / (totalTasks + 5)) * 100).toFixed(0) : 0}%</span>
                  </div>

                  <div className="flex justify-between items-center p-3 rounded-lg bg-yellow-500/10">
                    <span className="text-sm">Зростання</span>
                    <span className={`font-bold ${growthRate >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                      {growthRate >= 0 ? '+' : ''}{growthRate.toFixed(1)}%
                    </span>
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5 text-yellow-500" />
                    <span className="font-semibold">Рейтинг продуктивності</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-muted rounded-full h-3">
                      <div 
                        className="bg-gradient-to-r from-blue-500 to-purple-500 h-3 rounded-full transition-all"
                        style={{ width: `${Math.min((totalPosts * 2 + totalEarnings / 10 + totalBots * 5), 100)}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold">
                      {Math.min((totalPosts * 2 + totalEarnings / 10 + totalBots * 5), 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
      </>
        )}
      </div>
    </div>
  );
};

export default Analytics;


