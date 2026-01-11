import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, AlertCircle, Trash2, ClipboardList, Camera, Users, MessageCircle, Eye, ThumbsUp, Share2, FileText, TestTube, Briefcase } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type TaskStatus = "pending_moderation" | "approved" | "needs_revision" | "rejected";

export const TasksModeration = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<TaskStatus>("pending_moderation");
  const [deletingTask, setDeletingTask] = useState<any>(null);

  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ["tasks-moderation", statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          profiles!tasks_user_id_fkey (
            telegram_username,
            full_name,
            avatar_url
          )
        `)
        .eq("status", statusFilter)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Статистика по всіх статусах
  const { data: stats } = useQuery({
    queryKey: ["tasks-stats"],
    queryFn: async () => {
      const statuses: TaskStatus[] = ["pending_moderation", "approved", "needs_revision", "rejected"];
      const counts: Record<TaskStatus, number> = {
        pending_moderation: 0,
        approved: 0,
        needs_revision: 0,
        rejected: 0
      };

      for (const status of statuses) {
        const { count } = await supabase
          .from("tasks")
          .select("*", { count: "exact", head: true })
          .eq("status", status);
        counts[status] = count || 0;
      }

      return counts;
    },
  });

  // Realtime підписка на зміни завдань
  useEffect(() => {
    const channel = supabase
      .channel('tasks_moderation_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => {
          console.log('Task changed:', payload);
          // Оновлюємо якщо завдання створено зі статусом pending_moderation
          // або якщо статус змінено на pending_moderation
          if (payload.eventType === 'INSERT' && payload.new.status === 'pending_moderation') {
            queryClient.invalidateQueries({ queryKey: ["pending-tasks"] });
          } else if (payload.eventType === 'UPDATE') {
            // Оновлюємо список завдань та статистику
            queryClient.invalidateQueries({ queryKey: ["tasks-moderation"] });
            queryClient.invalidateQueries({ queryKey: ["tasks-stats"] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const getStatusLabel = (status: TaskStatus) => {
    const labels = {
      pending_moderation: "На розгляді",
      approved: "Схвалені",
      needs_revision: "На переробці",
      rejected: "Відхилені"
    };
    return labels[status];
  };

  const deleteTaskMutation = useMutation({
    mutationFn: async (task: any) => {
      // Delete task images from storage if any
      if (task.images && Array.isArray(task.images) && task.images.length > 0) {
        const filePaths = task.images
          .map((url: string) => {
            const match = url.match(/task-images\/(.+)$/);
            return match ? match[1] : null;
          })
          .filter(Boolean);

        if (filePaths.length > 0) {
          const { error: storageError } = await supabase.storage
            .from('task-images')
            .remove(filePaths);

          if (storageError) {
            console.error('Error deleting images:', storageError);
          }
        }
      }

      // Delete task from database
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", task.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Завдання видалено",
        description: "Завдання та всі пов'язані файли успішно видалено",
      });
      queryClient.invalidateQueries({ queryKey: ["tasks-moderation"] });
      queryClient.invalidateQueries({ queryKey: ["tasks-stats"] });
      setDeletingTask(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось видалити завдання",
        variant: "destructive",
      });
    },
  });

  const getStatusColor = (status: TaskStatus) => {
    const colors = {
      pending_moderation: "bg-warning/20 text-warning border-warning/30",
      approved: "bg-success/20 text-success border-success/30",
      needs_revision: "bg-primary/20 text-primary border-primary/30",
      rejected: "bg-destructive/20 text-destructive border-destructive/30"
    };
    return colors[status];
  };

  if (isLoading) {
    return <div className="text-center py-8">Завантаження...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <Button
          variant={statusFilter === "pending_moderation" ? "default" : "outline"}
          onClick={() => setStatusFilter("pending_moderation")}
          className={statusFilter === "pending_moderation" ? "bg-warning text-warning-foreground" : ""}
        >
          На розгляді
          {stats && <Badge variant="secondary" className="ml-2">{stats.pending_moderation}</Badge>}
        </Button>
        <Button
          variant={statusFilter === "approved" ? "default" : "outline"}
          onClick={() => setStatusFilter("approved")}
          className={statusFilter === "approved" ? "bg-success text-success-foreground" : ""}
        >
          Схвалені
          {stats && <Badge variant="secondary" className="ml-2">{stats.approved}</Badge>}
        </Button>
        <Button
          variant={statusFilter === "rejected" ? "default" : "outline"}
          onClick={() => setStatusFilter("rejected")}
          className={statusFilter === "rejected" ? "bg-destructive text-destructive-foreground" : ""}
        >
          Відхилені
          {stats && <Badge variant="secondary" className="ml-2">{stats.rejected}</Badge>}
        </Button>
      </div>

      {/* Tasks List */}
      {!tasks || tasks.length === 0 ? (
        <Card className="p-12 text-center bg-card/50 backdrop-blur-sm">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">
            Немає завдань зі статусом "{getStatusLabel(statusFilter)}"
          </p>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tasks.map((task: any, index: number) => {
            // Debug: перевірка даних
            if (index === 0) {
              console.log('Task sample:', {
                images: task.images,
                status: task.status,
                balance_type: task.balance_type,
                reward_amount: task.reward_amount
              });
            }
            
            const taskImage = task.images && task.images.length > 0 ? task.images[0] : null;
            
            const categoryConfig: Record<string, { label: string; icon: any }> = {
              telegram_subscription: { label: 'Підписка на Telegram канал', icon: MessageCircle },
              telegram_view: { label: 'Перегляд посту в Telegram', icon: Eye },
              telegram_reaction: { label: 'Реакція на пост в Telegram', icon: ThumbsUp },
              social_media: { label: 'Соціальні мережі', icon: Share2 },
              content_creation: { label: 'Створення контенту', icon: FileText },
              testing: { label: 'Тестування', icon: TestTube },
              general: { label: 'Загальне', icon: Briefcase }
            };
            
            const categoryInfo = categoryConfig[task.category] || { label: task.category, icon: Briefcase };
            const CategoryIcon = categoryInfo.icon;
            
            return (
            <Card 
              key={task.id}
              className="group hover:shadow-lg transition-all duration-300 animate-fade-in hover:border-primary/40 overflow-hidden"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              {/* Task Image or Icon */}
              <div className="relative h-32 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                {taskImage ? (
                  <img 
                    src={taskImage} 
                    alt={task.title}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <ClipboardList className="w-16 h-16 text-primary/30" />
                )}
                
                {/* Status Badge */}
                <div className="absolute top-2 left-2">
                  <Badge className={getStatusColor(task.status)}>
                    {getStatusLabel(task.status)}
                  </Badge>
                </div>
                
                {/* Balance Type Badge */}
                <div className="absolute top-2 right-2">
                  <Badge variant={task.balance_type === "main" ? "default" : "secondary"}>
                    {task.balance_type === "main" ? "Баланс" : "Бонусне"}
                  </Badge>
                </div>
              </div>

              <CardHeader className="space-y-3">
                {/* Author Info & Reward */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="w-6 h-6">
                      <AvatarImage src={task.profiles?.avatar_url} />
                      <AvatarFallback className="text-xs">
                        {(task.profiles?.telegram_username?.[0] || task.profiles?.full_name?.[0] || "?").toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs text-muted-foreground truncate max-w-[120px]">
                      {task.profiles?.telegram_username || task.profiles?.full_name || "Невідомий"}
                    </span>
                  </div>
                  
                  {/* Reward Badge */}
                  <Badge variant={task.balance_type === "main" ? "default" : "secondary"} className="text-xs font-bold">
                    {task.reward_amount.toFixed(2)} ₴
                  </Badge>
                </div>

                {/* Creation Date */}
                <div className="text-xs text-muted-foreground">
                  {format(new Date(task.created_at), "d MMMM yyyy, HH:mm", { locale: uk })}
                </div>

                {/* Category */}
                {task.category && (
                  <Badge variant="outline" className="w-fit text-xs flex items-center gap-1">
                    <CategoryIcon className="w-3 h-3" />
                    {categoryInfo.label}
                  </Badge>
                )}

                {/* Title */}
                <CardTitle className="line-clamp-2 text-base leading-tight">
                  {task.title}
                </CardTitle>
                
                {/* Description */}
                <CardDescription className="line-clamp-3 text-sm leading-relaxed">
                  {task.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Additional info */}
                <div className="space-y-2 text-xs">
                  {/* Time limit */}
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{task.time_limit_hours} год</span>
                  </div>

                  {/* Screenshot */}
                  {task.requires_screenshot && (
                    <div className="flex items-center gap-2 text-warning">
                      <Camera className="h-4 w-4" />
                      <span>Потрібен скріншот</span>
                    </div>
                  )}

                  {/* Max completions */}
                  {task.max_completions && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Users className="h-4 w-4" />
                      <span>1 раз на користувача</span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/admin/tasks/${task.id}`);
                    }}
                  >
                    Переглянути
                  </Button>
                  {statusFilter === "rejected" && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeletingTask(task);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      <AlertDialog open={!!deletingTask} onOpenChange={(open) => !open && setDeletingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Видалити завдання?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете видалити завдання "{deletingTask?.title}"? 
              Завдання та всі пов'язані файли будуть видалені назавжди. Цю дію неможливо скасувати.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Скасувати</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => deleteTaskMutation.mutate(deletingTask)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Так, видалити
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
