import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Bell, ExternalLink, Trash2, Eye, Settings, MessageSquare, Lock, CheckCircle, XCircle, Info, CheckCheck, X, PlayCircle, PauseCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { uk } from "date-fns/locale";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

interface NotificationsPopoverProps {
  unreadCount: number;
  onCountChange?: (count: number) => void;
}

export const NotificationsPopover = ({ unreadCount, onCountChange }: NotificationsPopoverProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Ініціалізуємо audio
  useEffect(() => {
    audioRef.current = new Audio('/sounds/notification.mp3');
    // Не встановлюємо volume - використовуємо системну гучність (за замовчуванням 1.0)
    // Гучність буде залежати від налаштувань телефону/ПК
    // Для APK - preload audio
    audioRef.current.load();
  }, []);

  useEffect(() => {
    if (open) {
      loadNotifications();
    }
  }, [open]);

  useEffect(() => {
    // Просте налаштування: поки що звук завжди увімкнений
    setSoundEnabled(true);
  }, []);

  // Update unread count when notifications change
  useEffect(() => {
    if (onCountChange) {
      const unread = notifications.filter(n => !n.is_read).length;
      onCountChange(unread);
    }
  }, [notifications, onCountChange]);

  useEffect(() => {
    const setupRealtimeSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('user_notifications')
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const newNotification = payload.new as Notification;
            
            setNotifications((prev) => {
              // Перевіряємо, чи сповіщення вже існує
              if (prev.some(n => n.id === newNotification.id)) {
                return prev;
              }
              return [newNotification, ...prev];
            });
            
            if (soundEnabled && audioRef.current) {
              // Для APK - reset перед play
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(err => {
                console.error('Sound play error:', err);
                // Для APK - спробувати ще раз після user interaction
                document.addEventListener('click', () => {
                  audioRef.current?.play().catch(console.error);
                }, { once: true });
              });
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const updatedNotification = payload.new as Notification;
            setNotifications((prev) =>
              prev.map((n) => (n.id === updatedNotification.id ? updatedNotification : n))
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            const deletedId = (payload.old as any).id;
            setNotifications((prev) => prev.filter((n) => n.id !== deletedId));
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupRealtimeSubscription();
  }, [soundEnabled, onCountChange]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3);

      if (error) throw error;

      setNotifications(data || []);
    } catch (error: any) {
      console.error("Error loading notifications:", error);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    try {
      const { error } = await supabase.rpc("mark_notification_read", {
        p_notification_id: notificationId,
      });

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, is_read: true } : n
        )
      );

      if (onCountChange) {
        onCountChange(Math.max(0, unreadCount - 1));
      }
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      const { error } = await supabase.rpc("mark_all_notifications_read");

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true }))
      );

      if (onCountChange) {
        onCountChange(0);
      }

      toast({
        title: "Успішно",
        description: "Всі сповіщення позначено як прочитані",
      });

      await loadNotifications();
    } catch (error: any) {
      console.error("Error marking all as read:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося позначити сповіщення",
        variant: "destructive",
      });
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Redirect to settings security tab for login notifications
    if (notification.type === "account_login") {
      navigate("/settings?tab=security");
      setOpen(false);
      return;
    }
    
    if (notification.link) {
      navigate(notification.link);
      setOpen(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "ticket_reply":
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case "account_login":
        return <Lock className="w-5 h-5 text-purple-500" />;
      case "task_approved":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "task_rejected":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "tariff_expired":
        return <XCircle className="w-5 h-5 text-orange-500" />;
      case "vip_expired":
        return <XCircle className="w-5 h-5 text-amber-500" />;
      case "bot_started":
        return <PlayCircle className="w-5 h-5 text-green-500" />;
      case "bot_stopped":
        return <PauseCircle className="w-5 h-5 text-gray-500" />;
      case "bot_error":
        return <XCircle className="w-5 h-5 text-red-500" />;
      case "system":
        return <Info className="w-5 h-5 text-yellow-500" />;
      default:
        return <Bell className="w-5 h-5 text-primary" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative flex items-center justify-center">
          <Bell className="h-5 w-5 transition-all" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center shadow-lg">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Bell className="w-4 h-4" />
            Сповіщення
            {unreadCount > 0 && (
              <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              Завантаження...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="w-12 h-12 mb-2 opacity-20" />
              <p className="text-sm">Немає сповіщень</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {notifications.map((notification) => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-all hover:shadow-sm bg-background/50 backdrop-blur-sm",
                    notification.is_read
                      ? "border-border/30"
                      : "border-primary/20 hover:bg-primary/5"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span className="flex-shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-medium text-sm line-clamp-1">
                          {notification.title}
                        </h4>
                        {!notification.is_read && (
                          <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), {
                          addSuffix: true,
                          locale: uk,
                        })}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />

        <div className="p-2 space-y-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                navigate("/notifications");
                setOpen(false);
              }}
            >
              <Eye className="w-4 h-4 mr-2" />
              Всі
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
            >
              <CheckCheck className="w-4 h-4 mr-2" />
              Переглянуто
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
