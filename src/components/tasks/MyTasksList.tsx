import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye, Edit, XCircle, Wallet, Trash2, Play, Square } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MyTaskDetailsDialog } from "./MyTaskDetailsDialog";
import { TaskBudgetDialog } from "./TaskBudgetDialog";
import { useToast } from "@/components/ui/use-toast";
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

const statusLabels: Record<string, { label: string; variant: any; color?: string }> = {
  pending_moderation: { label: "На модерації", variant: "secondary" },
  approved: { label: "Схвалено", variant: "default", color: "bg-green-500 text-white" },
  active: { label: "Активне", variant: "default", color: "bg-blue-500 text-white" },
  inactive: { label: "Не активне", variant: "outline", color: "bg-gray-500 text-white" },
  rejected: { label: "Відхилено", variant: "destructive" },
  completed: { label: "Завершено", variant: "outline" },
  cancelled: { label: "Скасовано", variant: "outline" },
};

export const MyTasksList = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [cancellingTask, setCancellingTask] = useState<any>(null);
  const [deletingTask, setDeletingTask] = useState<any>(null);
  const [budgetTask, setBudgetTask] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("all");
  const [sortBy, setSortBy] = useState<"date" | "budget" | "executions">("date");

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["my-tasks"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("tasks")
        .select(`
          *,
          task_submissions (
            id,
            status,
            user_id
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: userProfile } = useQuery({
    queryKey: ["user-profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("profiles")
        .select("balance, bonus_balance")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const cancelTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "cancelled" })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Успішно",
        description: "Завдання скасовано",
      });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      setCancellingTask(null);
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось скасувати завдання",
        variant: "destructive",
      });
    },
  });

  const activateTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "active" })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Завдання активовано",
        description: "Завдання тепер доступне для виконання!",
      });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["available-tasks"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось активувати завдання",
        variant: "destructive",
      });
    },
  });

  const deactivateTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("tasks")
        .update({ status: "inactive" })
        .eq("id", taskId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Завдання деактивовано",
        description: "Завдання переміщено в 'Не активні'",
      });
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["available-tasks"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Помилка",
        description: error.message || "Не вдалось деактивувати завдання",
        variant: "destructive",
      });
    },
  });

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
      queryClient.invalidateQueries({ queryKey: ["my-tasks"] });
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

  const canEdit = (status: string) => 
    ["pending_moderation", "rejected"].includes(status);
  
  const canCancel = (status: string) => 
    ["active", "approved"].includes(status);

  if (isLoading) {
    return <div className="text-center py-8">Завантаження...</div>;
  }

  if (!tasks || tasks.length === 0) {
    return (
      <Card className="text-center py-12">
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-lg">Ви ще не створили жодного завдання</p>
          <Button 
            onClick={() => navigate("/task-marketplace/create")}
            className="mt-4"
          >
            Створити завдання
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Filter and sort tasks by tab
  const filteredTasks = tasks
    .filter((task: any) => {
      if (activeTab === "all") return true;
      if (activeTab === "pending") return task.status === "pending_moderation";
      if (activeTab === "approved") return ["approved", "active", "inactive"].includes(task.status);
      if (activeTab === "rejected") return task.status === "rejected";
      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === "date") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      } else if (sortBy === "budget") {
        return (b.budget || 0) - (a.budget || 0);
      } else if (sortBy === "executions") {
        return (b.available_executions || 0) - (a.available_executions || 0);
      }
      return 0;
    });

  const renderTaskCard = (task: any) => {
    const submissionsCount = task.task_submissions?.length || 0;
    const submittedCount = task.task_submissions?.filter(
      (s: any) => s.status === "submitted"
    ).length || 0;

    return (
      <Card key={task.id}>
        <CardHeader>
          <div className="flex justify-between items-start mb-2">
            <Badge 
              variant={statusLabels[task.status]?.variant || "outline"}
              className={statusLabels[task.status]?.color || ""}
            >
              {statusLabels[task.status]?.label || task.status}
            </Badge>
            <Badge variant={task.task_type === "vip" ? "default" : "secondary"}>
              {task.task_type === "vip" ? "VIP" : "Бонусне"}
            </Badge>
          </div>
          <CardTitle className="line-clamp-1 text-base">{task.title}</CardTitle>
          <CardDescription>
            Винагорода: {task.reward_amount.toFixed(2)} ₴
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="space-y-2">
            {/* Description preview */}
            <p className="text-muted-foreground line-clamp-2 text-sm">{task.description}</p>
            
            {/* Rejection reason for rejected tasks */}
            {task.status === "rejected" && task.rejection_reason && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg mb-2">
                <p className="text-xs font-semibold text-destructive mb-1">Причина відхилення:</p>
                <p className="text-xs text-destructive/80">{task.rejection_reason}</p>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t text-sm">
              <span className="text-muted-foreground">Виконань:</span>
              <span className="font-medium">{submissionsCount}</span>
            </div>

            {submittedCount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-600 font-medium">Нових звітів:</span>
                <span className="text-orange-600 font-medium">{submittedCount}</span>
              </div>
            )}
            
            {/* Budget info for approved, active and inactive tasks */}
            {(task.status === "approved" || task.status === "active" || task.status === "inactive") && (
              <div className="pt-2 border-t space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Бюджет:</span>
                  <span className="font-medium">{task.budget?.toFixed(2) || "0.00"} ₴</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Доступно виконань:</span>
                  <span className={`font-medium ${(task.available_executions || 0) === 0 ? "text-destructive" : ""}`}>
                    {task.available_executions || 0}
                  </span>
                </div>
              </div>
            )}
          </div>
        </CardContent>

        <CardFooter className="flex gap-2 flex-wrap">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={() => setSelectedTask(task)}
          >
            <Eye className="h-4 w-4 mr-2" />
            Переглянути
          </Button>
          
          {task.status === "approved" && (
            <>
              {(task.budget || 0) > 0 ? (
                <Button 
                  variant="default"
                  size="icon"
                  className="bg-green-500 hover:bg-green-600"
                  onClick={() => activateTaskMutation.mutate(task.id)}
                  disabled={activateTaskMutation.isPending}
                  title="Запустити завдання"
                >
                  <Play className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  size="icon"
                  disabled
                  title="Поповніть бюджет щоб запустити"
                  className="opacity-50"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              
              <Button 
                variant="outline"
                size="icon"
                onClick={() => setBudgetTask(task)}
                title="Поповнити бюджет"
                className={(task.available_executions || 0) === 0 ? "border-orange-500 text-orange-500 hover:bg-orange-50" : ""}
              >
                <Wallet className="h-4 w-4" />
              </Button>
            </>
          )}
          
          {task.status === "active" && (
            <>
              <Button 
                variant="destructive"
                size="icon"
                onClick={() => deactivateTaskMutation.mutate(task.id)}
                disabled={deactivateTaskMutation.isPending}
                title="Зупинити завдання"
              >
                <Square className="h-4 w-4" fill="currentColor" />
              </Button>
              
              <Button 
                variant="outline"
                size="icon"
                onClick={() => setBudgetTask(task)}
                title="Поповнити бюджет"
                className={(task.available_executions || 0) === 0 ? "border-orange-500 text-orange-500 hover:bg-orange-50" : ""}
              >
                <Wallet className="h-4 w-4" />
              </Button>
            </>
          )}
          
          {task.status === "inactive" && (
            <>
              {(task.budget || 0) > 0 ? (
                <Button 
                  variant="default"
                  size="icon"
                  className="bg-green-500 hover:bg-green-600"
                  onClick={() => activateTaskMutation.mutate(task.id)}
                  disabled={activateTaskMutation.isPending}
                  title="Запустити завдання"
                >
                  <Play className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  variant="outline"
                  size="icon"
                  disabled
                  title="Поповніть бюджет щоб запустити"
                  className="opacity-50"
                >
                  <Play className="h-4 w-4" />
                </Button>
              )}
              
              <Button 
                variant="outline"
                size="icon"
                onClick={() => setBudgetTask(task)}
                title="Поповнити бюджет"
                className={(task.available_executions || 0) === 0 ? "border-orange-500 text-orange-500 hover:bg-orange-50" : ""}
              >
                <Wallet className="h-4 w-4" />
              </Button>
            </>
          )}
          
          {canEdit(task.status) && (
            <Button 
              variant="outline"
              size="icon"
              onClick={() => navigate(`/task-marketplace/edit/${task.id}`)}
              title="Редагувати"
            >
              <Edit className="h-4 w-4" />
            </Button>
          )}

          {task.status === "rejected" && (
            <Button 
              variant="destructive"
              size="icon"
              onClick={() => setDeletingTask(task)}
              title="Видалити"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
          
          {canCancel(task.status) && (
            <Button 
              variant="outline"
              size="icon"
              onClick={() => setCancellingTask(task)}
              title="Скасувати"
            >
              <XCircle className="h-4 w-4" />
            </Button>
          )}
        </CardFooter>
      </Card>
    );
  };

  // Calculate task counts by status
  const taskCounts = {
    all: tasks?.length || 0,
    pending: tasks?.filter((t: any) => t.status === "pending_moderation").length || 0,
    approved: tasks?.filter((t: any) => t.status === "approved").length || 0,
    active: tasks?.filter((t: any) => t.status === "active").length || 0,
    inactive: tasks?.filter((t: any) => t.status === "inactive").length || 0,
    rejected: tasks?.filter((t: any) => t.status === "rejected").length || 0,
    cancelled: tasks?.filter((t: any) => t.status === "cancelled").length || 0,
  };

  return (
    <>
      {/* Status Filters */}
      <div className="flex flex-wrap gap-2 mb-6">
        <Button
          size="sm"
          variant={activeTab === "all" ? "default" : "outline"}
          onClick={() => setActiveTab("all")}
          className={activeTab === "all" ? "bg-gradient-primary" : ""}
        >
          Всі <Badge variant="secondary" className="ml-2">{taskCounts.all}</Badge>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "pending" ? "default" : "outline"}
          onClick={() => setActiveTab("pending")}
          className={activeTab === "pending" ? "bg-gradient-primary" : ""}
        >
          На модерації <Badge variant="secondary" className="ml-2">{taskCounts.pending}</Badge>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "approved" ? "default" : "outline"}
          onClick={() => setActiveTab("approved")}
          className={activeTab === "approved" ? "bg-gradient-primary" : ""}
        >
          Схвалені <Badge variant="secondary" className="ml-2">{taskCounts.approved}</Badge>
        </Button>
        <Button
          size="sm"
          variant={activeTab === "rejected" ? "default" : "outline"}
          onClick={() => setActiveTab("rejected")}
          className={activeTab === "rejected" ? "bg-gradient-primary" : ""}
        >
          Відхилені <Badge variant="secondary" className="ml-2">{taskCounts.rejected}</Badge>
        </Button>
      </div>

      <div className="mt-6">
        {filteredTasks.length > 0 && (
          <div className="flex gap-2 mb-4">
              <Button
                variant={sortBy === "date" ? "default" : "outline"}
                size="sm"
                onClick={() => setSortBy("date")}
              >
                За датою
              </Button>
              {(activeTab === "all" || activeTab === "approved" || activeTab === "active" || activeTab === "inactive") && (
                <>
                  <Button
                    variant={sortBy === "budget" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy("budget")}
                  >
                    За бюджетом
                  </Button>
                  <Button
                    variant={sortBy === "executions" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSortBy("executions")}
                  >
                    За виконаннями
                  </Button>
                </>
              )}
          </div>
        )}
        
        {filteredTasks.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-lg">
                {activeTab === "all" && "Ви ще не створили жодного завдання"}
                {activeTab === "pending" && "Немає завдань на модерації"}
                {activeTab === "approved" && "Немає схвалених завдань"}
                {activeTab === "rejected" && "Немає відхилених завдань"}
              </p>
              {activeTab === "all" && (
                <Button 
                  onClick={() => navigate("/task-marketplace/create")}
                  className="mt-4"
                >
                  Створити завдання
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredTasks.map((task: any) => renderTaskCard(task))}
          </div>
        )}
      </div>

      <div className="hidden">
        {tasks.map((task: any) => {
          return null;
        })}
      </div>

      {selectedTask && (
        <MyTaskDetailsDialog
          task={selectedTask}
          open={!!selectedTask}
          onOpenChange={(open) => !open && setSelectedTask(null)}
        />
      )}

      {budgetTask && userProfile && (
        <TaskBudgetDialog
          task={budgetTask}
          open={!!budgetTask}
          onOpenChange={(open) => !open && setBudgetTask(null)}
          userBalance={userProfile.balance || 0}
          userBonusBalance={userProfile.bonus_balance || 0}
        />
      )}

      <AlertDialog open={!!cancellingTask} onOpenChange={(open) => !open && setCancellingTask(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Скасувати завдання?</AlertDialogTitle>
            <AlertDialogDescription>
              Ви впевнені, що хочете скасувати завдання "{cancellingTask?.title}"? 
              Ця дія не може бути скасована. Завдання більше не буде доступне для виконання.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ні, залишити</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelTaskMutation.mutate(cancellingTask?.id)}>
              Так, скасувати
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
    </>
  );
};
