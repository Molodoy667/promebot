import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  Bot,
  Settings,
  TrendingUp,
  DollarSign,
  Gift,
  Sparkles,
  Crown,
  MessageSquare,
  FileText,
  Users,
  Shield,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Wrench,
  Gamepad2,
  ListChecks,
  Star,
  Image,
  Pickaxe,
  Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";
import { Separator } from "./ui/separator";
import { Badge } from "./ui/badge";

interface DesktopSidebarProps {
  isAdmin?: boolean;
  isModerator?: boolean;
  isVip?: boolean;
  userId?: string;
}

export const DesktopSidebar = ({ isAdmin, isModerator, isVip, userId }: DesktopSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [collapsed, setCollapsed] = useState(false);
  
  // Counters
  const [postsCount, setPostsCount] = useState(0);
  const [channelsCount, setChannelsCount] = useState(0);
  const [ticketsCount, setTicketsCount] = useState(0);
  const [tasksCount, setTasksCount] = useState(0);
  const [referralsCount, setReferralsCount] = useState(0);

  useEffect(() => {
    if (userId) {
      loadCounters();
    }
  }, [userId]);

  const loadCounters = async () => {
    if (!userId) return;

    try {
      // Posts count
      const { data: botServices } = await supabase
        .from("bot_services")
        .select("id")
        .eq("user_id", userId);

      const { data: aiServices } = await supabase
        .from("ai_bot_services")
        .select("id")
        .eq("user_id", userId);

      let totalPosts = 0;
      if (botServices && botServices.length > 0) {
        const { count } = await supabase
          .from("posts_history")
          .select("*", { count: 'exact', head: true })
          .in("bot_service_id", botServices.map(s => s.id))
          .in("status", ["published", "success"]);
        totalPosts += count || 0;
      }

      if (aiServices && aiServices.length > 0) {
        const { count } = await supabase
          .from("ai_generated_posts")
          .select("*", { count: 'exact', head: true })
          .in("ai_bot_service_id", aiServices.map(s => s.id))
          .eq("status", "published");
        totalPosts += count || 0;
      }

      setPostsCount(totalPosts);
      setChannelsCount((botServices?.length || 0) + (aiServices?.length || 0));

      // Tickets count
      const { count: tickets } = await supabase
        .from("tickets")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId)
        .neq("status", "closed");
      setTicketsCount(tickets || 0);

      // Tasks count (created by user)
      const { count: tasks } = await supabase
        .from("tasks")
        .select("*", { count: 'exact', head: true })
        .eq("user_id", userId)
        .eq("status", "active");
      setTasksCount(tasks || 0);

      // Referrals count
      const { count: referrals } = await supabase
        .from("referrals")
        .select("*", { count: 'exact', head: true })
        .eq("referrer_id", userId);
      setReferralsCount(referrals || 0);

    } catch (error) {
      console.error("Помилка завантаження лічильників:", error);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      toast({
        title: "Вихід",
        description: "Ви вийшли з системи",
      });
      navigate("/");
    } catch (error: any) {
      toast({
        title: "Помилка",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const mainLinks = [
    { to: "/dashboard", icon: Home, label: "Головна", count: null },
    { to: "/my-channels", icon: Bot, label: "Мої канали", count: channelsCount },
    { to: "/bot-setup", icon: Settings, label: "Налаштування боту", count: null },
    { to: "/task-marketplace", icon: DollarSign, label: "Біржа завдань", count: tasksCount },
    { to: "/referral", icon: Gift, label: "Реферальна програма", count: referralsCount },
    { to: "/entertainment", icon: Gamepad2, label: "Розваги", count: null },
  ];

  const toolsLinks = [
    { to: "/tools", icon: Wrench, label: "Інструменти", count: null },
    { to: "/analytics", icon: TrendingUp, label: "Аналітика", count: null },
  ];

  const additionalLinks = [
    { to: "/tickets", icon: MessageSquare, label: "Підтримка", count: ticketsCount },
    { to: "/reviews", icon: Star, label: "Відгуки", count: null },
    { to: "/info", icon: FileText, label: "Загальна інформація", count: null },
    { to: "/settings", icon: Settings, label: "Налаштування", count: null },
  ];

  if (isVip) {
    additionalLinks.push({ to: "/vip-chat", icon: Crown, label: "VIP Чат", count: null });
  }

  const adminLinks = [];
  if (isAdmin) {
    adminLinks.push({ to: "/admin", icon: Shield, label: "Адмін-панель", count: null });
  }
  if (isModerator && !isAdmin) {
    adminLinks.push({ to: "/moderator", icon: Users, label: "Модерація", count: null });
  }

  const isActive = (path: string) => location.pathname === path;

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col fixed left-0 top-16 bottom-0 glass-effect border-r border-border/50 transition-all duration-300 z-30 backdrop-blur-xl",
        collapsed ? "w-16" : "w-64"
      )}
    >
      <div className="flex-1 overflow-y-auto py-4">
        {/* Main Navigation */}
        <div className="px-3 space-y-1">
          {mainLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors group",
                isActive(link.to)
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <link.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-medium truncate">{link.label}</span>}
              </div>
              <div className="flex items-center gap-2">
                {!collapsed && (link as any).badge && (
                  <Badge variant="secondary" className="bg-gradient-primary text-white text-xs px-2 py-0.5 animate-pulse">
                    {(link as any).badge}
                  </Badge>
                )}
                {!collapsed && link.count !== null && link.count > 0 && (
                  <Badge variant="secondary" className="flex-shrink-0 h-5 min-w-[20px] flex items-center justify-center px-1.5">
                    {link.count}
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>

        {toolsLinks.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="px-3 space-y-1">
              {!collapsed && (
                <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Інструменти
                </p>
              )}
              {toolsLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors group",
                    isActive(link.to)
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent text-muted-foreground hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <link.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="text-sm font-medium truncate">{link.label}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}

        <Separator className="my-4" />

        {/* Additional Links */}
        <div className="px-3 space-y-1">
          {!collapsed && (
            <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Додатково
            </p>
          )}
          {additionalLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors group",
                isActive(link.to)
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <link.icon className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="text-sm font-medium truncate">{link.label}</span>}
              </div>
              {!collapsed && link.count !== null && link.count > 0 && (
                <Badge variant="secondary" className="ml-auto flex-shrink-0 h-5 min-w-[20px] flex items-center justify-center px-1.5">
                  {link.count}
                </Badge>
              )}
            </Link>
          ))}
        </div>

        {/* Admin Links */}
        {adminLinks.length > 0 && (
          <>
            <Separator className="my-4" />
            <div className="px-3 space-y-1">
              {!collapsed && (
                <p className="px-3 text-xs font-semibold text-warning uppercase tracking-wider mb-2">
                  Управління
                </p>
              )}
              {adminLinks.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={cn(
                    "flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors group",
                    isActive(link.to)
                      ? "bg-warning/20 text-warning"
                      : "hover:bg-warning/10 text-muted-foreground hover:text-warning"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <link.icon className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="text-sm font-medium truncate">{link.label}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-border/50">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className={cn(
            "w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10",
            collapsed && "justify-center"
          )}
        >
          <LogOut className="w-5 h-5" />
          {!collapsed && <span className="ml-3">Вийти</span>}
        </Button>
      </div>

      {/* Toggle Button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -right-3 top-4 w-8 h-8 rounded-full border-2 border-primary/30 bg-gradient-to-br from-primary/20 to-primary/10 shadow-lg hover:shadow-primary/50 hover:border-primary hover:scale-110 transition-all duration-300 group"
      >
        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary via-primary-glow to-primary opacity-0 group-hover:opacity-100 blur-sm transition-opacity duration-300" />
        {collapsed ? (
          <ChevronRight className="w-4 h-4 relative z-10 group-hover:text-primary transition-colors" />
        ) : (
          <ChevronLeft className="w-4 h-4 relative z-10 group-hover:text-primary transition-colors" />
        )}
      </Button>
    </aside>
  );
};
