import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, AlertCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { format } from "date-fns";
import { uk } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

type TaskStatus = "pending_moderation" | "approved" | "needs_revision" | "rejected";

export const TasksModeration = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<TaskStatus>("pending_moderation");

  const { data: tasks, isLoading, error } = useQuery({
    queryKey: ["tasks-moderation", statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
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
          variant={statusFilter === "needs_revision" ? "default" : "outline"}
          onClick={() => setStatusFilter("needs_revision")}
          className={statusFilter === "needs_revision" ? "bg-primary text-primary-foreground" : ""}
        >
          На переробці
          {stats && <Badge variant="secondary" className="ml-2">{stats.needs_revision}</Badge>}
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
          {tasks.map((task: any, index: number) => (
            <Card 
              key={task.id}
              className="group cursor-pointer hover:shadow-lg transition-all duration-300 animate-fade-in hover:border-primary/40"
              style={{ animationDelay: `${index * 0.05}s` }}
              onClick={() => navigate(`/admin/tasks/${task.id}`)}
            >
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <div className="flex gap-2">
                    <Badge variant={task.task_type === "telegram_subscription" ? "default" : "secondary"}>
                      {task.task_type === "telegram_subscription" ? "📢 Підписка" : "📝 Завдання"}
                    </Badge>
                    <Badge className={getStatusColor(task.status)}>
                      {getStatusLabel(task.status)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 bg-gradient-to-br from-warning/20 to-warning/10 px-2 py-1 rounded-lg border border-warning/30">
                    <DollarSign className="w-3 h-3 text-warning" />
                    <span className="text-sm font-bold text-warning">{task.reward_amount.toFixed(2)}₴</span>
                  </div>
                </div>
            <CardTitle className="line-clamp-2 text-lg">{task.title}</CardTitle>
            <CardDescription className="line-clamp-2">
              {task.description}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{task.time_limit_hours} год</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <AlertCircle className="h-4 w-4" />
                <span>{format(new Date(task.created_at), "d MMM yyyy", { locale: uk })}</span>
              </div>
            </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
