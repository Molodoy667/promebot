import { ReactNode, useState, useEffect } from "react";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { SidebarProvider } from "@/components/ui/sidebar";
import { UserSidebar } from "@/components/UserSidebar";
import { DesktopSidebar } from "@/components/DesktopSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import { ParticleBackground } from "@/components/ParticleBackground";
import { isAndroidAPK } from "@/lib/platform";

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const isMobile = useIsMobile();
  const isAPK = isAndroidAPK();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [canSpin, setCanSpin] = useState(false);
  const [isVip, setIsVip] = useState(false);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [hasUnreadTickets, setHasUnreadTickets] = useState(false);
  const [unreadTicketsCount, setUnreadTicketsCount] = useState(0);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [channelsCount, setChannelsCount] = useState(0);
  const [subscription, setSubscription] = useState<any>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        loadProfile(session.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Subscribe to ticket updates and profile changes for realtime updates
  useEffect(() => {
    if (!profile?.id) return;

    const ticketSubscription = supabase
      .channel('tickets_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tickets',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          checkUnreadTickets(profile.id);
        }
      )
      .subscribe();

    // Real-time profile updates (balance, avatar, username, etc.)
    const profileSubscription = supabase
      .channel('profile_changes')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${profile.id}`,
        },
        (payload) => {
          console.log('Profile updated:', payload);
          // Оновлюємо весь профіль (включаючи avatar_url, username, etc.)
          setProfile((prev: any) => ({
            ...prev,
            ...payload.new,
          }));
        }
      )
      .subscribe();

    // Real-time VIP subscription updates
    const vipSubscription = supabase
      .channel('vip_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'vip_subscriptions',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          console.log('VIP subscription changed');
          checkVipStatus(profile.id);
        }
      )
      .subscribe();

    // Real-time channels count updates
    const channelsSubscription = supabase
      .channel('channels_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bot_services',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          console.log('Bot services changed');
          loadChannelsCount(profile.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_bot_services',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          console.log('AI services changed');
          loadChannelsCount(profile.id);
        }
      )
      .subscribe();

    // Real-time notifications updates
    const notificationsSubscription = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          console.log('Notifications changed');
          checkUnreadNotifications(profile.id);
        }
      )
      .subscribe();

    // Real-time wheel spins updates for roulette availability
    const wheelSpinsSubscription = supabase
      .channel('wheel_spins_changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'wheel_spins',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          console.log('Wheel spin added');
          checkRouletteAvailability(profile.id);
        }
      )
      .subscribe();

    // Real-time subscription updates
    const subscriptionChannel = supabase
      .channel('subscription_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          console.log('Subscription changed');
          loadActiveSubscription(profile.id);
        }
      )
      .subscribe();

    // Real-time bot services updates (channels count)
    const botServicesChannel = supabase
      .channel('bot_services_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'bot_services',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          console.log('Bot services changed');
          loadChannelsCount(profile.id);
        }
      )
      .subscribe();

    // Real-time AI bot services updates (channels count)
    const aiServicesChannel = supabase
      .channel('ai_bot_services_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'ai_bot_services',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          console.log('AI bot services changed');
          loadChannelsCount(profile.id);
        }
      )
      .subscribe();

    // Real-time notifications updates
    const notificationsChannel = supabase
      .channel('notifications_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`,
        },
        () => {
          console.log('Notifications changed');
          checkUnreadNotifications(profile.id);
        }
      )
      .subscribe();

    return () => {
      ticketSubscription.unsubscribe();
      profileSubscription.unsubscribe();
      vipSubscription.unsubscribe();
      wheelSpinsSubscription.unsubscribe();
      channelsSubscription.unsubscribe();
      notificationsSubscription.unsubscribe();
      subscriptionChannel.unsubscribe();
      botServicesChannel.unsubscribe();
      aiServicesChannel.unsubscribe();
      notificationsChannel.unsubscribe();
    };
  }, [profile?.id]);

  useEffect(() => {
    console.log('Layout render:', { isAuthenticated, isMobile, hasProfile: !!profile });
  }, [isAuthenticated, isMobile, profile]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAuthenticated(!!session);
    if (session) {
      await loadProfile(session.user.id);
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
      
      // Check user role
      const { data: adminData } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'admin'
      });
      
      const { data: moderatorData } = await supabase.rpc('has_role', {
        _user_id: userId,
        _role: 'moderator'
      });
      
      if (adminData) {
        setUserRole('admin');
      } else if (moderatorData) {
        setUserRole('moderator');
      } else {
        setUserRole('user');
      }
      
      // Check roulette availability
      checkRouletteAvailability(userId);
      
      // Check VIP status
      checkVipStatus(userId);
      
      // Check unread tickets
      checkUnreadTickets(userId);
      
      // Check unread notifications
      checkUnreadNotifications(userId);
      
      // Load channels count
      loadChannelsCount(userId);

      // Load active subscription
      loadActiveSubscription(userId);
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const checkUnreadTickets = async (userId: string) => {
    try {
      const { data: tickets } = await supabase
        .from("tickets")
        .select("unread_admin_replies")
        .eq("user_id", userId)
        .neq("status", "closed");

      if (tickets) {
        const totalUnread = tickets.reduce((sum: number, ticket: any) => sum + (ticket.unread_admin_replies || 0), 0);
        setUnreadTicketsCount(totalUnread);
        setHasUnreadTickets(totalUnread > 0);
      }
    } catch (error) {
      console.error("Error checking unread tickets:", error);
    }
  };

  const checkUnreadNotifications = async (userId: string) => {
    try {
      const { data, error } = await supabase.rpc('get_unread_notifications_count');

      if (error) throw error;

      setUnreadNotificationsCount(data || 0);
    } catch (error) {
      console.error("Error checking unread notifications:", error);
    }
  };

  const loadChannelsCount = async (userId: string) => {
    try {
      const { data: services } = await supabase
        .from("bot_services")
        .select("id")
        .eq("user_id", userId);
      
      const { data: aiServices } = await supabase
        .from("ai_bot_services")
        .select("id")
        .eq("user_id", userId);
      
      const count = (services?.length || 0) + (aiServices?.length || 0);
      console.log('Channels count loaded:', count);
      setChannelsCount(count);
    } catch (error) {
      console.error("Error loading channels count:", error);
    }
  };

  const loadActiveSubscription = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("subscriptions")
        .select(`
          *,
          tariffs (
            name,
            name_en,
            price,
            channels_limit,
            posts_per_month
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
        setCanSpin(true);
        return;
      }

      const lastSpin = new Date(data.created_at);
      const now = new Date();
      const hoursSinceLastSpin = (now.getTime() - lastSpin.getTime()) / (1000 * 60 * 60);
      
      setCanSpin(hoursSinceLastSpin >= 3);
    } catch (error) {
      console.error("Error checking roulette availability:", error);
    }
  };

  const checkVipStatus = async (userId: string) => {
    try {
      const { data } = await supabase
        .from("vip_subscriptions")
        .select("expires_at")
        .eq("user_id", userId)
        .maybeSingle();

      if (data && new Date(data.expires_at) > new Date()) {
        setIsVip(true);
      } else {
        setIsVip(false);
      }
    } catch (error) {
      console.error("Error checking VIP status:", error);
    }
  };

  const handleLogout = async () => {
    try {
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
      toast({
        title: "Помилка",
        description: "Не вдалося вийти з системи",
        variant: "destructive",
        duration: 1500,
      });
      navigate("/");
    }
  };

  if (isAuthenticated && isMobile) {
    return (
      <SidebarProvider defaultOpen={false}>
        <div className="min-h-screen w-full flex relative overflow-hidden">
          {/* Animated gradient background */}
          <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 animate-gradient-slow -z-20" />
          <div className="fixed inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 -z-10" />
          
          {/* Particle effect */}
          <ParticleBackground />
          
          {/* Animated Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
            <div className="absolute top-20 left-10 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-float-slow" />
            <div className="absolute top-40 right-20 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
            <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: '4s' }} />
            <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '6s' }} />
          </div>

          <UserSidebar
            profile={profile}
            userRole={userRole}
            canSpin={canSpin}
            onLogout={handleLogout}
            hasUnreadTickets={hasUnreadTickets}
            unreadTicketsCount={unreadTicketsCount}
            channelsCount={channelsCount}
            isVip={isVip}
            subscription={subscription}
          />
          
          <div className="flex-1 w-full flex flex-col min-w-0 min-h-screen relative z-10">
            <Header 
              isAuthenticated={isAuthenticated}
              profile={profile}
              userRole={userRole}
              isMobileSidebar={true}
              hasUnreadTickets={hasUnreadTickets}
              unreadTicketsCount={unreadTicketsCount}
            />
            <main className="flex-1 pt-16 pb-20">
              {children}
            </main>
            {/* Hide MobileBottomNav in APK mode */}
            {!isAPK && <MobileBottomNav unreadNotifications={unreadNotificationsCount} />}
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <div className="min-h-screen flex flex-col relative overflow-hidden">
      {/* Animated gradient background */}
      <div className="fixed inset-0 bg-gradient-to-br from-slate-950 via-indigo-950 to-violet-950 animate-gradient-slow -z-20" />
      <div className="fixed inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20 -z-10" />
      
      {/* Particle effect */}
      <ParticleBackground />
      
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/30 rounded-full blur-3xl animate-float-slow" />
        <div className="absolute top-40 right-20 w-96 h-96 bg-violet-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-20 left-1/4 w-80 h-80 bg-indigo-500/15 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: '4s' }} />
        <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl animate-float" style={{ animationDelay: '6s' }} />
      </div>

      <Header 
        isAuthenticated={isAuthenticated}
        profile={profile}
        userRole={userRole}
        isMobileSidebar={false}
      />
      
      {/* Desktop Sidebar - показується тільки на десктопі */}
      {isAuthenticated && profile && (
        <DesktopSidebar 
          isAdmin={userRole === 'admin'}
          isModerator={userRole === 'moderator'}
          isVip={isVip}
          userId={profile.id}
        />
      )}
      
      <main className={`flex-1 pt-16 ${isAPK ? 'pb-4' : 'pb-16 lg:pb-8'} relative z-10 transition-all duration-300 ${isAuthenticated ? 'lg:pl-64' : ''}`}>
        {children}
      </main>
      {/* Hide Footer in APK mode */}
      {!isAPK && <Footer />}
    </div>
  );
};

