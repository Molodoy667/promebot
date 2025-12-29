import { Home, Radio, Plus, Bell, User } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NotificationsPopover } from "./NotificationsPopover";
import { useState, useEffect } from "react";

interface MobileBottomNavProps {
  unreadNotifications?: number;
}

export const MobileBottomNav = ({ unreadNotifications = 0 }: MobileBottomNavProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notificationCount, setNotificationCount] = useState(unreadNotifications);

  // Update count when prop changes (initial load)
  useEffect(() => {
    setNotificationCount(unreadNotifications);
  }, [unreadNotifications]);

  const isActive = (path: string) => location.pathname === path;

  // Handler for realtime updates from NotificationsPopover
  const handleCountChange = (newCount: number) => {
    setNotificationCount(newCount);
  };

  const navItems = [
    { icon: Home, label: "Головна", path: "/dashboard" },
    { icon: Radio, label: "Мої канали", path: "/my-channels" },
    { icon: Plus, label: "", path: "/bot-setup", isSpecial: true },
    { icon: Bell, label: "Сповіщення", path: "/notifications", badge: notificationCount, isNotification: true },
    { icon: User, label: "Профіль", path: "/settings" },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      <div className="glass-effect border-t border-white/10 backdrop-blur-2xl">
        <div className="flex items-center justify-around px-2 py-2 safe-area-inset-bottom">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            const hasNotifications = item.badge && item.badge > 0;
            
            // Notification button with popover
            if (item.isNotification) {
              return (
                <div
                  key={item.path}
                  className={cn(
                    "relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-300",
                    active
                      ? "text-primary bg-primary/10"
                      : "text-muted-foreground",
                    hasNotifications && "animate-pulse"
                  )}
                >
                  <NotificationsPopover 
                    unreadCount={notificationCount} 
                    onCountChange={handleCountChange}
                  />
                  
                  {item.label && (
                    <span
                      className={cn(
                        "text-[10px] font-medium transition-all duration-300",
                        active
                          ? "text-primary"
                          : "text-muted-foreground"
                      )}
                    >
                      {item.label}
                    </span>
                  )}

                  {/* Active indicator */}
                  {active && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full" />
                  )}
                </div>
              );
            }

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-xl transition-all duration-300",
                  item.isSpecial
                    ? "bg-gradient-to-r from-primary to-purple-600 hover:from-primary/90 hover:to-purple-600/90 scale-110 -mt-4 shadow-lg shadow-primary/50"
                    : active
                    ? "text-primary bg-primary/10"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <div className="relative">
                  <Icon
                    className={cn(
                      "transition-all duration-300",
                      item.isSpecial
                        ? "w-7 h-7 text-white"
                        : active
                        ? "w-6 h-6"
                        : "w-5 h-5"
                    )}
                  />
                </div>
                
                {item.label && (
                  <span
                    className={cn(
                      "text-[10px] font-medium transition-all duration-300",
                      active
                        ? "text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </span>
                )}

                {/* Active indicator */}
                {active && !item.isSpecial && (
                  <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-primary rounded-full animate-pulse" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
