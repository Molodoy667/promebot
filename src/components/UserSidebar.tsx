import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { 
  User, 
  Wallet, 
  Gift, 
  MessageSquare, 
  Sparkles, 
  Layout,
  Radio,
  Shield,
  UserCog,
  LogOut,
  Briefcase,
  Crown,
  Wrench,
  Package,
  Gamepad2,
  TrendingUp,
  DollarSign,
  FileText,
  Star,
  Settings,
  Check,
  Clock
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  useSidebar,
} from "@/components/ui/sidebar";
import { supabase } from "@/integrations/supabase/client";
import { BonusBalanceDisplay } from "./BonusBalanceDisplay";
import { BalanceDisplay } from "./BalanceDisplay";

interface UserSidebarProps {
  profile: any;
  userRole: string | null;
  canSpin: boolean;
  onLogout: () => void;
  hasUnreadTickets?: boolean;
  unreadTicketsCount?: number;
  channelsCount?: number;
  isVip?: boolean;
  subscription?: any;
}

export function UserSidebar({ profile, userRole, canSpin, onLogout, hasUnreadTickets = false, unreadTicketsCount = 0, channelsCount = 0, isVip = false, subscription }: UserSidebarProps) {
  const navigate = useNavigate();
  const { open, setOpen, isMobile, openMobile, setOpenMobile } = useSidebar();
  const [rouletteAvailable, setRouletteAvailable] = useState(canSpin);
  const [timeRemaining, setTimeRemaining] = useState("");
  
  const isOpen = isMobile ? openMobile : open;
  const setIsOpen = isMobile ? setOpenMobile : setOpen;

  // Real-time roulette status checker
  useEffect(() => {
    const checkRouletteStatus = async () => {
      if (!profile?.id) return;

      try {
        const { data, error } = await supabase
          .from("wheel_spins")
          .select("created_at")
          .eq("user_id", profile.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error && error.code !== 'PGRST116') {
          console.error("Error checking roulette status:", error);
          return;
        }

        if (!data) {
          setRouletteAvailable(true);
          setTimeRemaining("");
          return;
        }

        const lastSpin = new Date(data.created_at);
        const now = new Date();
        const nextSpin = new Date(lastSpin.getTime() + 3 * 60 * 60 * 1000); // 3 hours
        const diff = nextSpin.getTime() - now.getTime();

        if (diff <= 0) {
          setRouletteAvailable(true);
          setTimeRemaining("");
        } else {
          setRouletteAvailable(false);
          const hours = Math.floor(diff / (1000 * 60 * 60));
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
          setTimeRemaining(`${hours}г ${minutes}хв`);
        }
      } catch (error) {
        console.error("Error checking roulette status:", error);
      }
    };

    // Check immediately
    checkRouletteStatus();

    // Then check every 10 seconds for real-time updates
    const interval = setInterval(checkRouletteStatus, 10000);

    return () => clearInterval(interval);
  }, [profile?.id]);

  const handleNavigation = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  // Swipe gesture handler
  useEffect(() => {
    let touchStartX = 0;
    let touchEndX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX = e.changedTouches[0].screenX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    };

    const handleSwipe = () => {
      // Swipe from left edge to open
      if (touchStartX < 50 && touchEndX > touchStartX + 100) {
        setIsOpen(true);
      }
      // Swipe to left to close
      if (isOpen && touchStartX > touchEndX + 50) {
        setIsOpen(false);
      }
    };

    document.addEventListener("touchstart", handleTouchStart);
    document.addEventListener("touchend", handleTouchEnd);

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isOpen, setIsOpen]);

  return (
    <>
      
      <Sidebar side="left" className="border-r border-sidebar-border/20 h-screen max-w-[280px] z-50">
        <SidebarContent className="overflow-y-auto relative">
        {/* User Info Header */}
        <div className="p-4 sm:p-6 border-b border-sidebar-border relative">
          {/* Close button */}
          <button
            onClick={() => setIsOpen(false)}
            className="absolute right-3 top-3 z-50 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-full p-2 shadow-lg transition-all duration-200 hover:scale-110 active:scale-95"
            aria-label="Закрити меню"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="w-12 h-12 sm:w-16 sm:h-16 border-2 border-primary/20 flex-shrink-0">
              <AvatarImage src={profile?.avatar_url || profile?.telegram_photo_url} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold text-base sm:text-lg">
                {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-sidebar-foreground truncate">
                {profile?.full_name || profile?.email}
              </h3>
              {userRole === 'admin' && (
                <Badge className="bg-warning/20 text-warning border-warning/30 text-xs mt-1">
                  Адмін
                </Badge>
              )}
              {userRole === 'moderator' && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-xs mt-1">
                  Модератор
                </Badge>
              )}
            </div>
          </div>

          {/* Balance Info */}
          <div className="space-y-2">
            <div className="flex items-center justify-between p-2 rounded-lg bg-sidebar-accent/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs sm:text-sm text-sidebar-foreground truncate">Баланс</span>
              </div>
              <span className="font-semibold text-xs sm:text-sm flex-shrink-0 ml-2">
                <BalanceDisplay 
                  amount={profile?.balance || 0} 
                  iconSize={16}
                />
              </span>
            </div>
            <div className="flex items-center justify-between p-2 rounded-lg bg-sidebar-accent/50">
              <div className="flex items-center gap-2 min-w-0">
                <Gift className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-sidebar-foreground flex-shrink-0" />
                <span className="text-xs sm:text-sm text-sidebar-foreground truncate">Бонуси</span>
              </div>
              <span className="font-semibold text-xs sm:text-sm flex-shrink-0 ml-2">
                <BonusBalanceDisplay 
                  amount={profile?.bonus_balance || 0} 
                  iconSize={16}
                />
              </span>
            </div>
            
            {/* Subscription Info */}
            {subscription && (
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <Package className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs font-medium text-muted-foreground">Діючий тариф:</span>
                </div>
                <p className="text-xs sm:text-sm font-semibold text-foreground truncate">
                  {subscription.tariffs?.name || subscription.tariffs?.name_en}
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">
                  До: {new Date(subscription.expires_at).toLocaleDateString("uk-UA")}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Menu */}
        <SidebarGroup>
          <SidebarGroupContent className="space-y-2 px-3">
            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3"
              onClick={() => handleNavigation("/dashboard")}
            >
              <Layout className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span>Особистий кабінет</span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3"
              onClick={() => handleNavigation("/my-channels")}
            >
              <Radio className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span className="flex-1 text-left">Мої канали</span>
              <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0">
                {channelsCount}
              </Badge>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3"
              onClick={() => handleNavigation("/entertainment")}
            >
              <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span className="flex-1 text-left truncate">Розваги</span>
              <Badge 
                variant="secondary" 
                className={`ml-2 text-[10px] px-2 py-0.5 flex items-center gap-1 ${rouletteAvailable ? 'bg-blue-500/20 text-blue-600 border-blue-500/30' : 'bg-gray-500/20 text-gray-600 border-gray-500/30'}`}
              >
                {rouletteAvailable ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
              </Badge>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3"
              onClick={() => handleNavigation("/referral")}
            >
              <Gift className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span>Реферальна програма</span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3"
              onClick={() => handleNavigation("/task-marketplace")}
            >
              <Briefcase className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span>Біржа завдань</span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3"
              onClick={() => handleNavigation("/tools")}
            >
              <Wrench className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span>Інструменти</span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3"
              onClick={() => handleNavigation("/analytics")}
            >
              <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span>Аналітика</span>
            </Button>

            {isVip && (
              <Button
                variant="outline"
                className="w-full justify-start text-sm h-auto py-3 border-amber-500/30 hover:bg-amber-500/10 group"
                onClick={() => handleNavigation("/vip-chat")}
              >
                <Crown className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0 text-amber-600 group-hover:text-amber-500" />
                <span className="text-amber-700 group-hover:text-amber-600">VIP Чат</span>
              </Button>
            )}

            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3 relative"
              onClick={() => handleNavigation("/tickets")}
            >
              <div className="relative flex-shrink-0">
                <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                {hasUnreadTickets && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
                )}
              </div>
              <span className="flex-1 text-left">Тікети</span>
              {unreadTicketsCount > 0 && (
                <Badge variant="secondary" className="ml-2 text-[10px] px-1.5 py-0 bg-success/20 text-success border-success/30">
                  {unreadTicketsCount}
                </Badge>
              )}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3"
              onClick={() => handleNavigation("/reviews")}
            >
              <Star className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span>Відгуки</span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3"
              onClick={() => handleNavigation("/info")}
            >
              <FileText className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span>Загальна інформація</span>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start text-sm h-auto py-3"
              onClick={() => handleNavigation("/settings")}
            >
              <Settings className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
              <span>Налаштування</span>
            </Button>

            {userRole === 'admin' && (
              <Button
                variant="outline"
                className="w-full justify-start text-sm h-auto py-3"
                onClick={() => handleNavigation("/admin")}
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span>Адмін панель</span>
              </Button>
            )}

            {userRole === 'moderator' && (
              <Button
                variant="outline"
                className="w-full justify-start text-sm h-auto py-3"
                onClick={() => handleNavigation("/moderator")}
              >
                <UserCog className="w-4 h-4 sm:w-5 sm:h-5 mr-2 flex-shrink-0" />
                <span>Модератор панель</span>
              </Button>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Logout Button */}
        <div className="mt-auto p-3 sm:p-4 border-t border-sidebar-border">
          <Button
            variant="outline"
            className="w-full justify-start text-sm"
            onClick={onLogout}
          >
            <LogOut className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
            Вийти
          </Button>
        </div>
      </SidebarContent>
    </Sidebar>
    </>
  );
}
