import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  Bot, 
  Users,
  CreditCard,
  Package,
  Shield,
  Settings as SettingsIcon,
  Globe,
  FileText,
  MessageSquare,
  BarChart3,
  Gift,
  HelpCircle,
  Sparkles,
  Wrench,
  Tag
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Loading } from "@/components/Loading";
import { PageBreadcrumbs } from "@/components/PageBreadcrumbs";


const Admin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { settings } = useGeneralSettings();
  
  // Data states
  const [users, setUsers] = useState<any[]>([]);
  const [tariffs, setTariffs] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);

  useEffect(() => {
    checkAuthAndRole();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        navigate("/auth");
      } else {
        setUser(session.user);
        checkUserRole(session.user.id);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  // Real-time updates for admin data
  useEffect(() => {
    if (!isAdmin) return;

    // Profiles updates
    const profilesChannel = supabase
      .channel('admin_profiles_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          console.log('Profile changed, reloading users...');
          loadUsers();
        }
      )
      .subscribe();

    // Tariffs updates
    const tariffsChannel = supabase
      .channel('admin_tariffs_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tariffs',
        },
        () => {
          console.log('Tariff changed, reloading tariffs...');
          loadTariffs();
        }
      )
      .subscribe();

    // Subscriptions updates
    const subscriptionsChannel = supabase
      .channel('admin_subscriptions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
        },
        () => {
          console.log('Subscription changed, reloading subscriptions...');
          loadSubscriptions();
        }
      )
      .subscribe();

    return () => {
      profilesChannel.unsubscribe();
      tariffsChannel.unsubscribe();
      subscriptionsChannel.unsubscribe();
    };
  }, [isAdmin]);

  const checkAuthAndRole = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    setUser(session.user);
    await checkUserRole(session.user.id);
  };

  const checkUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });

      if (error) throw error;

      if (!data) {
        toast({
          title: "Доступ заборонено",
          description: "У вас немає прав адміністратора",
          variant: "destructive",
          duration: 1500,
        });
        navigate("/dashboard");
        return;
      }

      setIsAdmin(true);
      await loadAllData();
    } catch (error: any) {
      console.error("Error checking role:", error);
      navigate("/dashboard");
    } finally {
      setIsLoading(false);
    }
  };

  const loadAllData = async () => {
    await Promise.all([
      loadUsers(),
      loadTariffs(),
      loadSubscriptions(),
    ]);
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error: any) {
      console.error("Error loading users:", error);
    }
  };

  const loadTariffs = async () => {
    try {
      const { data, error } = await supabase
        .from("tariffs")
        .select("*")
        .order("price", { ascending: true });

      if (error) throw error;
      setTariffs(data || []);
    } catch (error: any) {
      console.error("Error loading tariffs:", error);
    }
  };

  const loadSubscriptions = async () => {
    try {
      const { data: subsData, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          tariffs (
            name
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Load profiles separately
      const userIds = subsData?.map(s => s.user_id) || [];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);

      // Merge data
      const subsWithProfiles = subsData?.map(sub => ({
        ...sub,
        profiles: profilesData?.find(p => p.id === sub.user_id) || null,
      })) || [];

      setSubscriptions(subsWithProfiles);
    } catch (error: any) {
      console.error("Error loading subscriptions:", error);
    }
  };

  if (isLoading) {
    return <Loading message="Перевірка доступу..." />;
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
      <PageBreadcrumbs />
      <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Панель адміністратора</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Керування системою {settings.site_name || "TelePostBot"}
          </p>
        </div>

        {/* Auth Settings Card */}
        <Card className="p-4 sm:p-6 mb-6 sm:mb-8 glass-effect border-warning/30">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-2 flex items-center gap-2">
                <Shield className="w-5 h-5 text-warning" />
                Налаштування автентифікації
              </h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                Керування налаштуваннями реєстрації та входу користувачів
              </p>
              <div className="flex flex-col gap-2 text-xs sm:text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-warning animate-pulse"></div>
                  <span className="text-muted-foreground">
                    Налаштування знаходяться в Supabase Dashboard
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="text-muted-foreground">
                    Authentication → Providers → Email
                  </span>
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => {
                  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
                  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
                  if (projectRef) {
                    window.open(`https://supabase.com/dashboard/project/${projectRef}/auth/providers`, '_blank');
                  } else {
                    window.open('https://supabase.com/dashboard', '_blank');
                  }
                }}
                className="border-primary/20 hover:bg-primary/10 w-full sm:w-auto"
                size="sm"
              >
                <Shield className="w-4 h-4 mr-2" />
                Email Provider
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
                  const projectRef = supabaseUrl.split('//')[1]?.split('.')[0];
                  if (projectRef) {
                    window.open(`https://supabase.com/dashboard/project/${projectRef}/auth/users`, '_blank');
                  } else {
                    window.open('https://supabase.com/dashboard', '_blank');
                  }
                }}
                className="border-primary/20 hover:bg-primary/10 w-full sm:w-auto"
                size="sm"
              >
                <Users className="w-4 h-4 mr-2" />
                Користувачі
              </Button>
            </div>
          </div>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="p-4 sm:p-6 glass-effect border-border/50">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">{users.length}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Користувачів</p>
          </Card>

          <Card className="p-4 sm:p-6 glass-effect border-border/50">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-success/20 flex items-center justify-center">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-success" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">
              {subscriptions.filter(s => s.status === 'active').length}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground">Активних підписок</p>
          </Card>

          <Card className="p-4 sm:p-6 glass-effect border-border/50">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-warning/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 sm:w-6 sm:h-6 text-warning" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">{tariffs.length}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Тарифів</p>
          </Card>

          <Card className="p-4 sm:p-6 glass-effect border-border/50">
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                <Bot className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold mb-1">{subscriptions.length}</p>
            <p className="text-xs sm:text-sm text-muted-foreground">Всього підписок</p>
          </Card>
        </div>

        {/* Management Sections - Grid of Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2 sm:gap-3 md:gap-4">
          {/* Користувачі */}
          <Link to="/admin/users">
            <Card className="p-3 glass-effect border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center transition-colors">
                  <Users className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Користувачі</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Тарифи */}
          <Link to="/admin/tariffs">
            <Card className="p-3 glass-effect border-border/50 hover:border-success/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-success/20 group-hover:bg-success/30 flex items-center justify-center transition-colors">
                  <CreditCard className="w-4 h-4 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Тарифи</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Промокоди */}
          <Link to="/admin/promo-codes">
            <Card className="p-3 glass-effect border-border/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 group-hover:bg-purple-500/30 flex items-center justify-center transition-colors">
                  <Tag className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Промокоди</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* VIP */}
          <Link to="/admin/vip">
            <Card className="p-3 glass-effect border-border/50 hover:border-warning/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-warning/20 group-hover:bg-warning/30 flex items-center justify-center transition-colors">
                  <Shield className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">VIP</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Telegram Боти */}
          <Link to="/admin/bots">
            <Card className="p-3 glass-effect border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center transition-colors">
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Боти</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Канали */}
          <Link to="/admin/channels">
            <Card className="p-3 glass-effect border-border/50 hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-accent/20 group-hover:bg-accent/30 flex items-center justify-center transition-colors">
                  <Globe className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Канали</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Сторінки */}
          <Link to="/admin/pages">
            <Card className="p-3 glass-effect border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center transition-colors">
                  <FileText className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Сторінки</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Завдання */}
          <Link to="/admin/tasks">
            <Card className="p-3 glass-effect border-border/50 hover:border-success/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-success/20 group-hover:bg-success/30 flex items-center justify-center transition-colors">
                  <Package className="w-4 h-4 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Завдання</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Тікети */}
          <Link to="/admin/tickets">
            <Card className="p-3 glass-effect border-border/50 hover:border-warning/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-warning/20 group-hover:bg-warning/30 flex items-center justify-center transition-colors">
                  <MessageSquare className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Тікети</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Загальні налаштування */}
          <Link to="/admin/general">
            <Card className="p-3 glass-effect border-border/50 hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-accent/20 group-hover:bg-accent/30 flex items-center justify-center transition-colors">
                  <SettingsIcon className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Загальні</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Безпека */}
          <Link to="/admin/security">
            <Card className="p-3 glass-effect border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center transition-colors">
                  <Shield className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Безпека</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Telegram Auth */}
          <Link to="/admin/telegram-auth">
            <Card className="p-3 glass-effect border-border/50 hover:border-success/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-success/20 group-hover:bg-success/30 flex items-center justify-center transition-colors">
                  <Bot className="w-4 h-4 text-success" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Telegram</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Ліміти Supabase */}
          <Link to="/admin/limits">
            <Card className="p-3 glass-effect border-border/50 hover:border-warning/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-warning/20 group-hover:bg-warning/30 flex items-center justify-center transition-colors">
                  <BarChart3 className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Ліміти</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* FAQ */}
          <Link to="/admin/faq">
            <Card className="p-3 glass-effect border-border/50 hover:border-primary/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/20 group-hover:bg-primary/30 flex items-center justify-center transition-colors">
                  <HelpCircle className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">FAQ</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Відгуки */}
          <Link to="/admin/reviews">
            <Card className="p-3 glass-effect border-border/50 hover:border-warning/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-warning/20 group-hover:bg-warning/30 flex items-center justify-center transition-colors">
                  <MessageSquare className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Відгуки</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Розваги (Лотерея, Рулетка, Призи) */}
          <Link to="/admin/entertainment">
            <Card className="p-3 glass-effect border-border/50 hover:border-purple/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 group-hover:bg-purple-500/30 flex items-center justify-center transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-purple-500"><rect x="2" y="7" width="20" height="15" rx="2" ry="2"/><polyline points="17 2 12 7 7 2"/></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Розваги</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Реферальна програма */}
          <Link to="/admin/referral">
            <Card className="p-3 glass-effect border-border/50 hover:border-emerald/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 group-hover:bg-emerald-500/30 flex items-center justify-center transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Реферали</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Журнал дій */}
          <Link to="/admin/audit-log">
            <Card className="p-3 glass-effect border-border/50 hover:border-blue/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 group-hover:bg-blue-500/30 flex items-center justify-center transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-500"><path d="M12 8v4l3 3"/><path d="M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20z"/><path d="M12 2v4"/></svg>
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Журнал</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* AI Сервіси */}
          <Link to="/admin/ai-services">
            <Card className="p-3 glass-effect border-border/50 hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 group-hover:bg-purple-500/30 flex items-center justify-center transition-colors">
                  <Sparkles className="w-4 h-4 text-purple-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">AI Сервіси</h3>
                </div>
              </div>
            </Card>
          </Link>

          {/* Налаштування інструментів */}
          <Link to="/admin/tools-settings">
            <Card className="p-3 glass-effect border-border/50 hover:border-orange-500/50 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] cursor-pointer group">
              <div className="flex flex-col items-center text-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 group-hover:bg-orange-500/30 flex items-center justify-center transition-colors">
                  <Wrench className="w-4 h-4 text-orange-500" />
                </div>
                <div>
                  <h3 className="font-semibold text-xs sm:text-sm">Інструменти</h3>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
  );
};

export default Admin;
