import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, Menu, X, Sparkles, CreditCard } from "lucide-react";
import { useGeneralSettings } from "@/hooks/useGeneralSettings";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface HeaderProps {
  isAuthenticated: boolean;
  profile: any;
  userRole: string | null;
  isMobileSidebar: boolean;
  hasUnreadTickets?: boolean;
  unreadTicketsCount?: number;
}

export const Header = ({ isAuthenticated, profile, userRole, isMobileSidebar, hasUnreadTickets = false, unreadTicketsCount = 0 }: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { settings } = useGeneralSettings();
  const navigate = useNavigate();

  const scrollToSection = (sectionId: string) => {
    setIsMenuOpen(false);
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  if (isMobileSidebar) {
    return (
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/20 backdrop-blur-xl bg-background/30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2">
            {settings.logo_url ? (
              <img 
                src={settings.logo_url} 
                alt={settings.site_name} 
                className="h-10 w-auto object-contain"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
                <Bot className="w-6 h-6 text-primary-foreground" />
              </div>
            )}
            <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
              {settings.site_name || "TelePostBot"}
            </span>
          </Link>

          <SidebarTrigger className="p-0 hover:bg-transparent focus:outline-none relative">
            <Avatar className="w-10 h-10 border-2 border-primary/20 hover:border-primary/40 transition-colors cursor-pointer">
              <AvatarImage src={profile?.avatar_url || profile?.telegram_photo_url} />
              <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
                {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            {hasUnreadTickets && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-success rounded-full animate-pulse border-2 border-background" />
            )}
          </SidebarTrigger>
        </div>
      </header>
    );
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/20 backdrop-blur-xl bg-background/30">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to={isAuthenticated ? "/dashboard" : "/"} className="flex items-center gap-2">
          {settings.logo_url ? (
            <img 
              src={settings.logo_url} 
              alt={settings.site_name} 
              className="h-10 w-auto object-contain"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Bot className="w-6 h-6 text-primary-foreground" />
            </div>
          )}
          <span className="text-xl font-bold bg-gradient-to-r from-primary to-primary-glow bg-clip-text text-transparent">
            {settings.site_name || "TelePostBot"}
          </span>
        </Link>

        {isAuthenticated ? (
          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              onClick={() => navigate("/dashboard")}
              className="text-foreground hover:text-primary hidden lg:flex"
            >
              Кабінет
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/my-channels")}
              className="text-foreground hover:text-primary hidden lg:flex"
            >
              Мої канали
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/roulette")}
              className="text-foreground hover:text-primary hidden lg:flex"
            >
              Рулетка
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/referral")}
              className="text-foreground hover:text-primary hidden lg:flex"
            >
              Реферальна програма
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/task-marketplace")}
              className="text-foreground hover:text-primary hidden lg:flex"
            >
              Біржа завдань
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/tools")}
              className="text-foreground hover:text-primary hidden lg:flex"
            >
              Інструменти
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/vip-chat")}
              className="text-foreground hover:text-primary hidden lg:flex"
            >
              VIP чат
            </Button>
            <Button
              variant="ghost"
              onClick={() => navigate("/tickets")}
              className="text-foreground hover:text-primary hidden lg:flex relative"
            >
              Тікети
              {hasUnreadTickets && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full animate-pulse" />
              )}
            </Button>
            {userRole === 'admin' && (
              <Button
                variant="ghost"
                onClick={() => navigate("/admin")}
                className="text-foreground hover:text-primary hidden lg:flex"
              >
                Адмін
              </Button>
            )}
            {userRole === 'moderator' && (
              <Button
                variant="ghost"
                onClick={() => navigate("/moderator")}
                className="text-foreground hover:text-primary hidden lg:flex"
              >
                Модератор
              </Button>
            )}
            <button className="flex items-center gap-2 focus:outline-none relative" onClick={() => navigate("/dashboard")}>
              <Avatar className="w-10 h-10 border-2 border-primary/20 hover:border-primary/40 transition-colors cursor-pointer">
                <AvatarImage src={profile?.avatar_url || profile?.telegram_photo_url} />
                <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
                  {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
            </button>
          </nav>
        ) : (
          <>
            <nav className="hidden md:flex items-center gap-6">
              <button
                onClick={() => scrollToSection("features")}
                className="text-foreground hover:text-primary transition-smooth font-medium flex items-center gap-2"
              >
                <Sparkles className="w-4 h-4" />
                Можливості
              </button>
              <button
                onClick={() => scrollToSection("pricing")}
                className="text-foreground hover:text-primary transition-smooth font-medium flex items-center gap-2"
              >
                <CreditCard className="w-4 h-4" />
                Тарифи
              </button>
              <Link
                to="/auth"
                className="text-foreground hover:text-primary transition-smooth font-medium"
              >
                Увійти
              </Link>
              <Button
                asChild
                className="bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow text-primary-foreground font-semibold"
              >
                <Link to="/auth">Почати</Link>
              </Button>
            </nav>

            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-foreground hover:text-primary"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </>
        )}
      </div>

      {isMenuOpen && !isAuthenticated && (
        <div className="md:hidden border-t border-border/20 glass-effect">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-4">
            <button
              onClick={() => scrollToSection("features")}
              className="text-foreground hover:text-primary transition-smooth font-medium py-2 text-left flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              Можливості
            </button>
            <button
              onClick={() => scrollToSection("pricing")}
              className="text-foreground hover:text-primary transition-smooth font-medium py-2 text-left flex items-center gap-2"
            >
              <CreditCard className="w-4 h-4" />
              Тарифи
            </button>
            <Link
              to="/auth"
              className="text-foreground hover:text-primary transition-smooth font-medium py-2"
              onClick={() => setIsMenuOpen(false)}
            >
              Увійти
            </Link>
            <Button
              asChild
              className="bg-gradient-primary hover:opacity-90 transition-smooth shadow-glow text-primary-foreground font-semibold"
              onClick={() => setIsMenuOpen(false)}
            >
              <Link to="/auth">Почати</Link>
            </Button>
          </nav>
        </div>
      )}
    </header>
  );
};
