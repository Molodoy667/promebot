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
  ResponsiveContainer 
} from "recharts";
import { 
  TrendingUp, 
  DollarSign, 
  Bot, 
  MessageSquare,
  Calendar,
  Award,
  Users,
  Activity
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";
import { PageHeader } from "@/components/PageHeader";

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
  
  // Stats
  const [totalPosts, setTotalPosts] = useState(0);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalBots, setTotalBots] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  
  // Charts data
  const [postsData, setPostsData] = useState<PostsStats[]>([]);
  const [earningsData, setEarningsData] = useState<EarningsStats[]>([]);
  const [botsData, setBotsData] = useState<BotStats[]>([]);

  useEffect(() => {
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

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
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({ title: "Помилка", description: "Потрібна авторизація", variant: "destructive" });
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

      // Load posts statistics
      const { data: postsHistory } = await supabase
        .from('posts_history')
        .select('created_at, status')
        .gte('created_at', startDate.toISOString())
        .eq('status', 'success')
        .order('created_at', { ascending: true });

      if (postsHistory) {
        setTotalPosts(postsHistory.length);
        
        // Group by date
        const grouped = postsHistory.reduce((acc: Record<string, number>, post) => {
          const date = new Date(post.created_at).toLocaleDateString('uk-UA');
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {});

        const chartData = Object.entries(grouped).map(([date, count]) => ({
          date,
          count
        }));
        
        setPostsData(chartData);
      }

      // Load earnings from miner game
      const { data: minerData } = await supabase
        .from('miner_game_data')
        .select('total_earned')
        .eq('user_id', user.id)
        .single();

      // Load transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('amount, type, created_at')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString())
        .in('type', ['referral_bonus', 'task_reward', 'wheel_spin', 'lottery_win']);

      let totalEarned = minerData?.total_earned || 0;
      
      if (transactions) {
        const transactionsSum = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
        totalEarned += transactionsSum;

        // Group by date and source
        const earningsGrouped: Record<string, { date: string; amount: number; source: string }[]> = {};
        
        transactions.forEach(t => {
          const date = new Date(t.created_at).toLocaleDateString('uk-UA');
          if (!earningsGrouped[date]) {
            earningsGrouped[date] = [];
          }
          
          earningsGrouped[date].push({
            date,
            amount: Number(t.amount),
            source: t.type
          });
        });

        const earningsChart = Object.values(earningsGrouped).flat();
        setEarningsData(earningsChart);
      }

      setTotalEarnings(totalEarned);

      // Load bots stats
      const { data: bots } = await supabase
        .from('telegram_bots')
        .select('bot_name, posts_count, channels_count')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (bots) {
        setTotalBots(bots.length);
        setBotsData(bots.map(b => ({
          bot_name: b.bot_name || 'Без імені',
          posts_count: b.posts_count || 0,
          channels_count: b.channels_count || 0
        })));
      }

      // Load tasks stats
      const { count: tasksCount } = await supabase
        .from('task_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('status', 'approved');

      setTotalTasks(tasksCount || 0);

    } catch (error) {
      console.error("Error loading analytics:", error);
      toast({ title: "Помилка", description: "Помилка завантаження аналітики", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen">
      <PageBreadcrumbs />
      <div className="container mx-auto p-4 space-y-6 pb-20">
        <PageHeader
          icon={Activity}
          title="Аналітика"
          description="Детальна статистика вашої активності та використання платформи"
        >
          <Select value={timeRange} onValueChange={(value: any) => setTimeRange(value)}>
            <SelectTrigger className="w-[180px] mt-4">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Останні 7 днів</SelectItem>
              <SelectItem value="30d">Останні 30 днів</SelectItem>
              <SelectItem value="90d">Останні 90 днів</SelectItem>
              <SelectItem value="1y">Останній рік</SelectItem>
              <SelectItem value="all">Весь час</SelectItem>
            </SelectContent>
          </Select>
        </PageHeader>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6 bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Публікацій</p>
              <p className="text-3xl font-bold mt-2">{totalPosts}</p>
            </div>
            <MessageSquare className="w-12 h-12 text-blue-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Заробіток</p>
              <p className="text-3xl font-bold mt-2">{totalEarnings.toLocaleString()}</p>
            </div>
            <DollarSign className="w-12 h-12 text-green-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-purple-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Активних ботів</p>
              <p className="text-3xl font-bold mt-2">{totalBots}</p>
            </div>
            <Bot className="w-12 h-12 text-purple-500 opacity-50" />
          </div>
        </Card>

        <Card className="p-6 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border-yellow-500/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Задач виконано</p>
              <p className="text-3xl font-bold mt-2">{totalTasks}</p>
            </div>
            <Award className="w-12 h-12 text-yellow-500 opacity-50" />
          </div>
        </Card>
      </div>

      {/* Charts */}
      <Tabs defaultValue="posts" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="posts">Публікації</TabsTrigger>
          <TabsTrigger value="earnings">Заробіток</TabsTrigger>
          <TabsTrigger value="bots">Боти</TabsTrigger>
        </TabsList>

        {/* Posts Chart */}
        <TabsContent value="posts">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Динаміка Публікацій</h2>
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
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area 
                    type="monotone" 
                    dataKey="count" 
                    stroke="#6366f1" 
                    fillOpacity={1} 
                    fill="url(#colorPosts)" 
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
            <div className="flex items-center gap-2 mb-6">
              <DollarSign className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Динаміка Заробітку</h2>
            </div>
            
            {earningsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={earningsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="amount" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <DollarSign className="w-16 h-16 mx-auto mb-4 opacity-50" />
                  <p>Немає даних про заробіток</p>
                </div>
              </div>
            )}
          </Card>
        </TabsContent>

        {/* Bots Chart */}
        <TabsContent value="bots">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <Bot className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-bold">Статистика Ботів</h2>
            </div>
            
            {botsData.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={botsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bot_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
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
      </Tabs>
      </div>
    </div>
  );
};

export default Analytics;


