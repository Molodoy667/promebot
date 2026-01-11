import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bell, Check, CheckCheck, ExternalLink, Loader2, Settings, Trash2, MessageSquare, Lock, CheckCircle, XCircle, Info, PlayCircle, PauseCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { uk } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export default function Notifications() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadNotifications();

    // Real-time підписка на нові сповіщення
    const channel = supabase
      .channel("notifications_changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
        },
        () => {
          loadNotifications();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  const loadNotifications = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      setNotifications(data || []);
    } catch (error: any) {
      console.error("Error loading notifications:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося завантажити сповіщення",
        variant: "destructive",
      });
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
          n.id === notificationId ? { ...n, is_read: true, read_at: new Date().toISOString() } : n
        )
      );
    } catch (error: any) {
      console.error("Error marking notification as read:", error);
    }
  };

  const markAllAsRead = async () => {
    try {
      setMarkingAllRead(true);
      const { error } = await supabase.rpc("mark_all_notifications_read");

      if (error) throw error;

      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );

      toast({
        title: "Успішно",
        description: "Всі сповіщення позначено як прочитані",
      });
    } catch (error: any) {
      console.error("Error marking all notifications as read:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося позначити всі сповіщення",
        variant: "destructive",
      });
    } finally {
      setMarkingAllRead(false);
    }
  };

  const clearAllNotifications = async () => {
    try {
      setClearing(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setNotifications([]);

      toast({
        title: "Успішно",
        description: "Всі сповіщення видалено",
      });
    } catch (error: any) {
      console.error("Error clearing notifications:", error);
      toast({
        title: "Помилка",
        description: "Не вдалося очистити сповіщення",
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Redirect based on notification type
    switch (notification.type) {
      case "account_login":
        navigate("/settings?tab=security");
        return;
      
      case "task_approved":
      case "task_rejected":
        // Завдання схвалено/відхилено - перехід до моїх завдань
        navigate("/task-marketplace?tab=my-tasks");
        return;
      
      case "task_submission_approved":
      case "task_submission_rejected":
        // Виконання схвалено/відхилено - перехід до моїх виконань
        navigate("/task-marketplace?tab=my-submissions");
        return;
      
      default:
        // Для інших типів використовуємо link якщо є
        if (notification.link) {
          navigate(notification.link);
        }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "ticket_reply":
        return <MessageSquare className="w-6 h-6 text-blue-500" />;
      case "account_login":
        return <Lock className="w-6 h-6 text-purple-500" />;
      case "task_approved":
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case "task_rejected":
        return <XCircle className="w-6 h-6 text-red-500" />;
      case "task_submission_approved":
        return <CheckCircle className="w-6 h-6 text-green-500" />;
      case "task_submission_rejected":
        return <XCircle className="w-6 h-6 text-red-500" />;
      case "tariff_expired":
        return <XCircle className="w-6 h-6 text-orange-500" />;
      case "vip_expired":
        return <XCircle className="w-6 h-6 text-amber-500" />;
      case "bot_started":
        return <PlayCircle className="w-6 h-6 text-green-500" />;
      case "bot_stopped":
        return <PauseCircle className="w-6 h-6 text-gray-500" />;
      case "bot_error":
        return <XCircle className="w-6 h-6 text-red-500" />;
      case "system":
        return <Info className="w-6 h-6 text-yellow-500" />;
      default:
        return <Bell className="w-6 h-6 text-primary" />;
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  if (loading) {
    return (
      <div className="container mx-auto p-4 max-w-4xl">
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 max-w-4xl">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-6 h-6" />
              Сповіщення
              {unreadCount > 0 && (
                <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {unreadCount}
                </span>
              )}
            </CardTitle>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={markAllAsRead}
                  disabled={markingAllRead}
                >
                  {markingAllRead ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCheck className="w-4 h-4 mr-2" />
                  )}
                  Позначити всі
                </Button>
              )}
              {notifications.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={clearAllNotifications}
                  disabled={clearing}
                >
                  {clearing ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4 mr-2" />
                  )}
                  Очистити
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/profile#notifications")}
              >
                <Settings className="w-4 h-4 mr-2" />
                Налаштування
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {notifications.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Bell className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>У вас поки немає сповіщень</p>
            </div>
          ) : (
            <ScrollArea className="h-[calc(100vh-300px)] pr-4">
              <div className="space-y-2">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      "w-full text-left p-4 rounded-lg border transition-all hover:shadow-md bg-background/50 backdrop-blur-sm",
                      notification.is_read
                        ? "border-border/30"
                        : "border-primary/20 hover:bg-primary/5"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5">{getNotificationIcon(notification.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="font-semibold text-sm">{notification.title}</h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {!notification.is_read && (
                              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                            )}
                            {notification.link && (
                              <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            )}
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                        <p className="text-xs text-muted-foreground mt-2">
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
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
