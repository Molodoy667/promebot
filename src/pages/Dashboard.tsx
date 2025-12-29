import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { TariffCard } from "@/components/TariffCard";
import { TariffCheckout } from "@/components/TariffCheckout";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TransactionsHistory } from "@/components/TransactionsHistory";
import { DepositDialog } from "@/components/DepositDialog";
import { VipDialog } from "@/components/VipDialog";
import { LimitsDialog } from "@/components/LimitsDialog";
import { useBrowserInfo } from "@/hooks/use-browser-info";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { ReferralCodeDialog } from "@/components/ReferralCodeDialog";
import { 
  Bot, 
  CreditCard, 
  TrendingUp, 
  Settings, 
  LogOut,
  Plus,
  Play,
  Pause,
  BarChart3,
  Users,
  DollarSign,
  Shield,
  Edit2,
  Package,
  Activity,
  Globe,
  Monitor,
  Edit,
  ChevronDown,
  ChevronUp,
  Wallet,
  Gift,
  Info,
  Sparkles,
  Crown,
  Gamepad2
} from "lucide-react";

// Referral Earnings Component
const ReferralEarnings = ({ userId }: { userId: string }) => {
  const [earnings, setEarnings] = useState(0);

  useEffect(() => {
    if (!userId) return;
    
    const fetchEarnings = async () => {
      try {
        const { data, error } = await supabase
          .from("referrals")
          .select("bonus_amount")
          .eq("referrer_id", userId);

        if (!error && data) {
          setEarnings(data.reduce((sum, ref) => sum + (ref.bonus_amount || 0), 0));
        }
      } catch (error) {
        console.error("Error fetching referral earnings:", error);
      }
    };

    fetchEarnings();
  }, [userId]);

  return (
    <>
      <p className="text-2xl font-bold mb-1 truncate">{earnings.toFixed(2)}₴</p>
      <p className="text-sm text-muted-foreground truncate">Реферальна програма →</p>
    </>
  );
};
import { useToast } from "@/components/ui/use-toast";
import { BonusBalanceDisplay } from "@/components/BonusBalanceDisplay";
import { BalanceDisplay } from "@/components/BalanceDisplay";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isModerator, setIsModerator] = useState(false);
  const [subscription, setSubscription] = useState<any>(null);
  const [isSelectTariffOpen, setIsSelectTariffOpen] = useState(false);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [selectedTariff, setSelectedTariff] = useState<any>(null);
  const [showCheckout, setShowCheckout] = useState(false);
  const [isDepositDialogOpen, setIsDepositDialogOpen] = useState(false);
  const [isTelegramAuth, setIsTelegramAuth] = useState(false);
  const [isGoogleAuth, setIsGoogleAuth] = useState(false);
  const [showTransactions, setShowTransactions] = useState(false);
  const [canSpinRoulette, setCanSpinRoulette] = useState(false);
  const [vipStatus, setVipStatus] = useState<any>(null);
  const [showVipDialog, setShowVipDialog] = useState(false);
  const [showLimitsDialog, setShowLimitsDialog] = useState(false);
  const [postsCount, setPostsCount] = useState(0);
  const [channelsCount, setChannelsCount] = useState(0);
  const [showReferralDialog, setShowReferralDialog] = useState(false);
  const browserInfo = useBrowserInfo();
  const { settings } = useGeneralSettings();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Session error:", error);
          navigate("/auth");
          return;
        }
        
        if (!session) {
          navigate("/auth");
          return;
        }

        setUser(session.user);
        loadProfile(session.user.id);
        loadTariffs();
      } catch (error) {
        console.error("Auth check error:", error);
        navigate("/auth");
      }
    };

    checkAuth();
    
    // Check VIP expiration every minute
    const vipCheckInterval = setInterval(() => {
      if (user?.id) {
        checkVipStatus(user.id);
      }
    }, 60000); // 60 seconds

    return () => clearInterval(vipCheckInterval);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.id);
      
      if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        setSubscription(null);
        navigate("/auth");
      } else if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          setUser(session.user);
          await loadProfile(session.user.id);
        }
      } else if (!session) {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Real-time updates for dashboard data
  useEffect(() => {
    if (!profile?.id) return;

    // Profile updates (balance, etc.)
    const profileChannel = supabase
      .channel('dashboard_profile_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('Profile updated in dashboard:', payload);
          setProfile((prev: any) => ({
            ...prev,
            ...payload.new,
          }));
        }
      )
      .subscribe();

    // Subscription updates
    const subscriptionChannel = supabase
      .channel('dashboard_subscription_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          loadSubscription(profile.id);
        }
      )
      .subscribe();

    // VIP status updates
    const vipChannel = supabase
      .channel('dashboard_vip_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vip_subscriptions',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          checkVipStatus(profile.id);
        }
      )
      .subscribe();

    // Wheel spins updates
    const wheelChannel = supabase
      .channel('dashboard_wheel_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'wheel_spins',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          checkRouletteAvailability(profile.id);
        }
      )
      .subscribe();

    // Bot services updates (for channels count)
    const botServicesChannel = supabase
      .channel('dashboard_bot_services_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bot_services',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          loadStats(profile.id);
        }
      )
      .subscribe();

    // Posts history updates (for posts count)
    const postsChannel = supabase
      .channel('dashboard_posts_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts_history',
        },
        () => {
          loadStats(profile.id);
        }
      )
      .subscribe();

    return () => {
      profileChannel.unsubscribe();
      subscriptionChannel.unsubscribe();
      vipChannel.unsubscribe();
      wheelChannel.unsubscribe();
      botServicesChannel.unsubscribe();
      postsChannel.unsubscribe();
    };
  }, [profile?.id]);

  const loadTariffs = async () => {
    try {
      const { data, error } = await supabase
        .from("tariffs")
        .select("*")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      setTariffs(data || []);
    } catch (error) {
      console.error("Error loading tariffs:", error);
    }
  };

  const loadProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) throw error;
      setProfile(data);
      setIsTelegramAuth(data?.auth_provider === 'telegram');
      setIsGoogleAuth(!!data?.google_id);
      
      // Check if user is admin or moderator
      const { data: adminData } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });
      
      const { data: moderatorData } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'moderator'
      });
      
      console.log('Role check:', { admin: adminData, moderator: moderatorData, userId });
      setIsAdmin(adminData || false);
      setIsModerator(moderatorData || false);
      
      // Load subscription
      await loadSubscription(userId);
      
      // Check roulette availability
      await checkRouletteAvailability(userId);

      // Check VIP status
      await checkVipStatus(userId);

      // Load stats
      await loadStats(userId);

      // Show referral dialog for users who haven't entered a code yet
      if (!data.has_entered_referral) {
        setShowReferralDialog(true);
      }
    } catch (error: any) {
      console.error("Error loading profile:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadStats = async (userId: string) => {
    try {
      // Get bot services (plagiarist) for this user
      const { data: botServices } = await supabase
        .from("bot_services")
        .select("id")
        .eq("user_id", userId);

      // Get AI bot services for this user
      const { data: aiServices } = await supabase
        .from("ai_bot_services")
        .select("id")
        .eq("user_id", userId);

      const totalChannels = (botServices?.length || 0) + (aiServices?.length || 0);
      setChannelsCount(totalChannels);

      // Get posts count from plagiarist bots
      let totalPosts = 0;
      if (botServices && botServices.length > 0) {
        const { count: plagiaristCount } = await supabase
          .from("posts_history")
          .select("*", { count: 'exact', head: true })
          .in("bot_service_id", botServices.map(s => s.id))
          .in("status", ["published", "success"]);

        totalPosts += plagiaristCount || 0;
      }

      // Get posts count from AI bots
      if (aiServices && aiServices.length > 0) {
        const { count: aiCount } = await supabase
          .from("ai_generated_posts")
          .select("*", { count: 'exact', head: true })
          .in("ai_bot_service_id", aiServices.map(s => s.id))
          .eq("status", "published");

        totalPosts += aiCount || 0;
      }

      setPostsCount(totalPosts);
    } catch (error) {
      console.error("Error loading stats:", error);
    }
  };

  const checkRouletteAvailability = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("wheel_spins")
        .select("created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setCanSpinRoulette(true);
        return;
      }

      const lastSpin = new Date(data.created_at);
      const now = new Date();
      const hoursSinceLastSpin = (now.getTime() - lastSpin.getTime()) / (1000 * 60 * 60);
      
      setCanSpinRoulette(hoursSinceLastSpin >= 3);
    } catch (error) {
      console.error("Error checking roulette availability:", error);
    }
  };

  const loadSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          tariffs (
            name,
            price,
            channels_limit,
            posts_per_month,
            bots_limit,
            sources_limit
          )
        `)
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setSubscription(data);
    } catch (error: any) {
      console.error("Error loading subscription:", error);
    }
  };

  const checkVipStatus = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("vip_subscriptions")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (data && new Date(data.expires_at) > new Date()) {
        setVipStatus(data);
      } else {
        setVipStatus(null);
      }
    } catch (error) {
      console.error("Error checking VIP status:", error);
    }
  };

  const handleLogout = async () => {
    try {
      // Очистити локальні дані перед виходом
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error("Logout error:", error);
        toast({
          title: "Помилка",
          description: "Не вдалося вийти з системи",
          variant: "destructive",
          duration: 1500,
        });
        return;
      }

      // Очистити локальне сховище
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();

      toast({
        title: "Успішно",
        description: "Ви вийшли з системи",
        duration: 1500,
      });

      navigate("/");
    } catch (error) {
      console.error("Unexpected logout error:", error);
      navigate("/");
    }
  };

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="min-h-screen overflow-x-hidden">
      <PageBreadcrumbs />
      <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8 max-w-7xl">
        {/* Profile Card */}
        <Card className={`p-4 sm:p-6 mb-4 sm:mb-6 glass-effect relative overflow-hidden max-w-full ${
          vipStatus ? "bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 border-2 border-amber-300" : "border-border/50"
        }`}>
          {vipStatus && (
            <>
              {/* Animated background */}
              <div className="absolute inset-0 opacity-20">
                <div className="absolute inset-0 bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 animate-pulse"></div>
                <div className="absolute top-0 left-1/4 w-48 h-48 bg-amber-500 rounded-full blur-3xl animate-pulse"></div>
                <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-yellow-500 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
              </div>
              <Crown className="absolute top-4 right-4 w-32 h-32 text-amber-300/20 -rotate-12 z-10" />
            </>
          )}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
            <Avatar className="w-20 h-20 sm:w-24 sm:h-24 border-4 border-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground text-2xl sm:text-3xl">
                {profile?.full_name?.charAt(0)?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            
            <div className="flex-1 text-center sm:text-left relative z-20">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 mb-2">
                <h2 className={`text-xl sm:text-2xl font-bold ${vipStatus ? "text-amber-900" : "text-foreground"}`}>
                  {profile?.full_name || "Користувач"}
                </h2>
                {vipStatus && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-amber-300">
                    <Crown className="w-3 h-3 mr-1" />
                    VIP
                  </Badge>
                )}
                {isAdmin && (
                  <Badge className="bg-warning/20 text-warning border-warning/30">
                    <Shield className="w-3 h-3 mr-1" />
                    Адмін
                  </Badge>
                )}
                {isModerator && !isAdmin && (
                  <Badge className="bg-primary/20 text-primary border-primary/30">
                    <Shield className="w-3 h-3 mr-1" />
                    Модератор
                  </Badge>
                )}
              </div>
              <p className="text-sm sm:text-base text-muted-foreground mb-1">
                {profile?.email || user?.email}
              </p>
              {profile?.phone && (
                <p className="text-sm text-muted-foreground mb-2">
                  {profile.phone}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 text-xs mt-2">
                <div className={`flex items-center gap-1 justify-center sm:justify-start ${vipStatus ? "text-amber-800" : "text-muted-foreground"}`}>
                  <Monitor className="w-3 h-3" />
                  <span>{browserInfo.browser}</span>
                </div>
                <div className={`flex items-center gap-1 justify-center sm:justify-start ${vipStatus ? "text-amber-800" : "text-muted-foreground"}`}>
                  <Globe className="w-3 h-3" />
                  <span>{browserInfo.ip}</span>
                </div>
              </div>

              {/* VIP Button or Status */}
              <div className="mt-4">
                {vipStatus && new Date(vipStatus.expires_at) > new Date() ? (
                  <div className="glass-effect p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                    <div className="flex items-center justify-center gap-2">
                      <Crown className="w-4 h-4 text-amber-600" />
                      <p className="text-sm font-medium text-foreground">
                        VIP активний до: {new Date(vipStatus.expires_at).toLocaleString("uk-UA", {
                          day: '2-digit',
                          month: '2-digit', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                ) : (
                  <Button
                    onClick={() => setShowVipDialog(true)}
                    variant="outline"
                    className="w-full sm:w-auto border-amber-500/30 hover:bg-amber-500/10 group"
                  >
                    <Crown className="w-4 h-4 mr-2 text-amber-600 group-hover:text-amber-500" />
                    <span className="text-amber-600 group-hover:text-amber-500 font-medium">Придбати VIP</span>
                  </Button>
                )}
              </div>

              {isTelegramAuth && (
                <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-center gap-2">
                  <Bot className="w-4 h-4 text-primary" />
                  <p className="text-sm text-foreground font-medium">Авторизовано через Telegram</p>
                </div>
              )}
              
              {isGoogleAuth && !isTelegramAuth && (
                <div className="mt-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  <p className="text-sm text-foreground font-medium">Авторизовано через Google</p>
                </div>
              )}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={() => navigate("/settings")}
              className="border-primary/20 hover:bg-primary/10 absolute top-4 right-4 sm:relative sm:top-0 sm:right-0"
            >
              <Edit2 className="w-4 h-4" />
            </Button>
          </div>
        </Card>

        {/* Balance Card */}
        <Card className="p-4 sm:p-6 md:p-8 mb-6 sm:mb-8 glass-effect border-primary/20 shadow-card relative overflow-hidden max-w-full">
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-primary opacity-10 rounded-full blur-3xl -translate-y-32 translate-x-32 -z-10"></div>
          
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 sm:mb-6 gap-4">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs sm:text-sm text-muted-foreground">Основний баланс</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center justify-center hover:scale-110 transition-transform">
                          <Info className="w-3.5 h-3.5 text-muted-foreground hover:text-primary transition-colors cursor-pointer" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 z-[100]" side="top" align="start">
                        <div className="space-y-2">
                          <h4 className="font-medium leading-none">Основний баланс</h4>
                          <p className="text-sm text-muted-foreground">
                            Ви можете поповнювати баланс та виводити кошти з балансу, а також витрачати їх на рекламу, завдання, тарифи тощо
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-3xl sm:text-4xl md:text-5xl font-bold">
                    <BalanceDisplay 
                      amount={profile?.balance || 0} 
                      iconSize={32}
                      className="text-foreground"
                    />
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-xs sm:text-sm text-muted-foreground">Бонусний баланс</p>
                    <Popover>
                      <PopoverTrigger asChild>
                        <button className="inline-flex items-center justify-center hover:scale-110 transition-transform">
                          <Info className="w-3.5 h-3.5 text-primary hover:text-primary/80 transition-colors cursor-pointer" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-80 z-[100]" side="top" align="start">
                        <div className="space-y-2">
                          <h4 className="font-medium leading-none">Бонусний баланс</h4>
                          <p className="text-sm text-muted-foreground">
                            Ви можете заробляти бонусні кошти запрошуючи друзів та крутячи рулетку та витратити їх на оплату тарифу, вивід бонусного рахунку не передбачений
                          </p>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <p className="text-xl sm:text-2xl font-semibold">
                    <BonusBalanceDisplay 
                      amount={profile?.bonus_balance || 0} 
                      iconSize={20}
                    />
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Button 
                onClick={() => setIsDepositDialogOpen(true)}
                className="bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow w-full sm:w-auto"
              >
                <Plus className="w-4 h-4 mr-2" />
                Поповнити
              </Button>
              <Button variant="outline" className="border-primary/20 hover:bg-primary/10 w-full sm:w-auto">
                Вивести
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowTransactions(!showTransactions)}
                className="border border-border/30 hover:bg-accent/50 w-full sm:w-auto"
              >
                {showTransactions ? <ChevronUp className="w-4 h-4 mr-2" /> : <ChevronDown className="w-4 h-4 mr-2" />}
                Мої операції
              </Button>
            </div>
          </div>

          {/* Collapsible Transactions */}
          {showTransactions && user && (
            <div className="mt-4 pt-4 border-t border-border/30">
              <TransactionsHistory userId={user.id} />
            </div>
          )}
        </Card>

        {/* Subscription Card */}
        <Card className="p-4 sm:p-6 mb-6 sm:mb-8 glass-effect border-border/50 overflow-hidden max-w-full">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-4 flex-1">
            {subscription && (() => {
              const lowerName = subscription.tariffs?.name?.toLowerCase() || "";
              let IconComponent = Package;
              if (lowerName.includes("базов") || lowerName.includes("basic") || lowerName.includes("starter")) {
                IconComponent = Package;
              } else if (lowerName.includes("стандарт") || lowerName.includes("standard") || lowerName.includes("pro")) {
                IconComponent = CreditCard;
              } else if (lowerName.includes("преміум") || lowerName.includes("premium") || lowerName.includes("enterprise")) {
                IconComponent = TrendingUp;
              }
              return (
                <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow flex-shrink-0">
                  <IconComponent className="w-6 h-6 sm:w-7 sm:h-7 text-primary-foreground" />
                </div>
              );
            })()}
            {!subscription && (
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
                <Package className="w-6 h-6 sm:w-7 sm:h-7 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-base sm:text-lg font-semibold">
                  {subscription ? subscription.tariffs?.name : "Немає активного тарифу"}
                </h3>
                {subscription && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLimitsDialog(true)}
                    className="h-7 px-2 text-xs hover:bg-primary/10"
                  >
                    <Activity className="w-3.5 h-3.5 mr-1" />
                    Ліміти
                  </Button>
                )}
              </div>
              {subscription ? (
                <>
                  <p className="text-sm text-muted-foreground mb-2">
                    {subscription.tariffs?.price} ₴/місяць • {subscription.tariffs?.bots_limit} ботів • {subscription.tariffs?.channels_limit} каналів • {subscription.tariffs?.sources_limit} джерел • {subscription.tariffs?.posts_per_month} постів/день
                  </p>
                  {subscription.expires_at && (
                    <p className="text-xs text-muted-foreground">
                      Діє до: {new Date(subscription.expires_at).toLocaleString('uk-UA', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Оберіть тариф, щоб почати користуватися ботом
                </p>
              )}
            </div>
          </div>
            <Button
              onClick={() => setIsSelectTariffOpen(true)}
              variant={subscription ? "outline" : "default"}
              className={subscription 
                ? "border-primary/20 hover:bg-primary/10 w-full sm:w-auto" 
                : "bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow w-full sm:w-auto"}
            >
              {subscription ? "Змінити тариф" : "Обрати тариф"}
            </Button>
          </div>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="p-6 glass-effect border-border/50 overflow-hidden cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate("/publications")}>
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <BarChart3 className="w-6 h-6 text-success" />
              </div>
            </div>
            <p className="text-2xl font-bold mb-1 truncate">{postsCount}</p>
            <p className="text-sm text-muted-foreground truncate">Публікації →</p>
          </Card>

          <Card 
            className="p-6 glass-effect border-border/50 overflow-hidden cursor-pointer hover:border-primary/30 transition-colors"
            onClick={() => navigate("/my-channels")}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="w-6 h-6 text-primary" />
              </div>
            </div>
            <p className="text-2xl font-bold mb-1 truncate">{channelsCount}</p>
            <p className="text-sm text-muted-foreground truncate">Мої канали →</p>
          </Card>

          <Card 
            className="p-6 glass-effect border-border/50 cursor-pointer hover:border-primary/30 transition-colors overflow-hidden"
            onClick={() => navigate("/referral")}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <Gift className="w-6 h-6 text-warning" />
              </div>
            </div>
            <ReferralEarnings userId={user?.id || ""} />
          </Card>

          <Card 
            className="p-6 glass-effect border-border/50 cursor-pointer hover:border-primary/30 transition-colors overflow-hidden"
            onClick={() => navigate("/task-marketplace")}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-info/20 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-info" />
              </div>
            </div>
            <p className="text-2xl font-bold mb-1 truncate">Завдання</p>
            <p className="text-sm text-muted-foreground truncate">Біржа завдань →</p>
          </Card>

          <Card 
            className="p-6 glass-effect border-border/50 cursor-pointer hover:border-primary/30 transition-colors relative overflow-hidden"
            onClick={() => navigate("/entertainment")}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Gamepad2 className="w-6 h-6 text-primary-foreground" />
              </div>
              <Badge 
                variant="secondary" 
                className={`text-xs px-2 py-1 ${canSpinRoulette ? 'bg-blue-500/20 text-blue-600 border-blue-500/30' : 'bg-gray-500/20 text-gray-600 border-gray-500/30'}`}
              >
                {canSpinRoulette ? "✅" : "⏰"}
              </Badge>
            </div>
            <p className="text-2xl font-bold mb-1 truncate">Розваги</p>
            <p className="text-sm text-muted-foreground truncate">Рулетка, лотерея та ігри →</p>
          </Card>
        </div>

        {/* Bot Service Card */}
        <Card className="p-8 glass-effect border-border/50 overflow-hidden max-w-full">
          <div className="text-center py-12">
            <div className="w-20 h-20 rounded-2xl bg-gradient-primary/10 flex items-center justify-center mx-auto mb-6">
              <Bot className="w-10 h-10 text-primary" />
            </div>
            <h3 className="text-2xl font-bold mb-2">
              {subscription ? "Керування ботом" : "Налаштуйте свого бота"}
            </h3>
            <p className="text-muted-foreground mb-8 max-w-md mx-auto">
              {subscription 
                ? "Налаштуйте бота для автоматичного копіювання постів з обраних каналів"
                : "Для того щоб користуватись послугами оберіть тариф"
              }
            </p>
            {subscription ? (
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Button
                  size="lg"
                  onClick={() => navigate("/bot-setup")}
                  className="bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow"
                >
                  <Settings className="w-5 h-5 mr-2" />
                  Керування Ботом
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() => navigate("/my-channels")}
                  className="border-primary/20 hover:bg-primary/10"
                >
                  <Bot className="w-5 h-5 mr-2" />
                  Мої канали
                </Button>
              </div>
            ) : (
              <Button
                size="lg"
                onClick={() => setIsSelectTariffOpen(true)}
                className="bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow"
              >
                <Plus className="w-5 h-5 mr-2" />
                Обрати тариф
              </Button>
            )}
          </div>
        </Card>
      </div>

      {/* Tariff Selection Dialog */}
      {user && (
        <>
          <Dialog open={isSelectTariffOpen} onOpenChange={setIsSelectTariffOpen}>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
              <DialogHeader className="pb-3 sm:pb-4">
                <DialogTitle className="text-xl sm:text-2xl">Оберіть тариф</DialogTitle>
                <DialogDescription className="text-xs sm:text-sm">
                  Порівняйте тарифи та оберіть найкращий для вас
                </DialogDescription>
              </DialogHeader>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mt-3 sm:mt-4">
                {tariffs.filter(t => t && t.id).map((tariff) => (
                  <TariffCard
                    key={tariff.id}
                    tariff={tariff}
                    isCurrentTariff={subscription?.tariff_id === tariff.id}
                    onSelect={(t) => {
                      setSelectedTariff(t);
                      setIsSelectTariffOpen(false);
                      setShowCheckout(true);
                    }}
                  />
                ))}
              </div>
              
              {tariffs.length === 0 && (
                <div className="text-center py-8 sm:py-12">
                  <p className="text-sm sm:text-base text-muted-foreground">
                    Тарифи не знайдено
                  </p>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {user && (
            <TariffCheckout
              isOpen={showCheckout}
              onClose={() => setShowCheckout(false)}
              tariff={selectedTariff}
              userBalance={profile?.balance || 0}
              userBonusBalance={profile?.bonus_balance || 0}
              userId={user.id}
              onSuccess={() => {
                loadProfile(user.id);
                setShowCheckout(false);
                toast({ title: "✅ Тариф успішно активовано!" });
              }}
            />
          )}

          <VipDialog
            open={showVipDialog}
            onOpenChange={setShowVipDialog}
            userId={user.id}
            currentBalance={profile?.balance || 0}
            onSuccess={() => {
              loadProfile(user.id);
            }}
          />

          <LimitsDialog
            open={showLimitsDialog}
            onOpenChange={setShowLimitsDialog}
            userId={user.id}
            subscription={subscription}
          />
        </>
      )}

      {/* Deposit Dialog */}
      {user && profile && (
        <DepositDialog
          open={isDepositDialogOpen}
          onOpenChange={setIsDepositDialogOpen}
          userId={user.id}
          currentBalance={profile.balance || 0}
          onSuccess={() => {
            if (user) {
              loadProfile(user.id);
            }
          }}
        />
      )}

      {/* Referral Code Dialog - shown once for new users who haven't entered a code */}
      {user && profile && !profile.has_entered_referral && (
        <ReferralCodeDialog
          isOpen={showReferralDialog}
          onClose={() => {
            setShowReferralDialog(false);
            setProfile((prev: any) => prev ? { ...prev, has_entered_referral: true } : prev);
          }}
          userId={user.id}
        />
      )}
    </div>
  );
};

export default Dashboard;

